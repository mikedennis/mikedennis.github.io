(function () {
    'use strict';

    var app = {
        isLoading: true,
        visibleCards: {},
        selectedNodes: [],
        rpcPasswords: {},
        spinner: document.querySelector('.loader'),
        cardTemplate: document.querySelector('.cardTemplate'),
        container: document.querySelector('.main'),
        addDialog: document.querySelector('.dialog-container'),
        nodeTypesEnum: {"Stratis":1, "Bitcoin":2}
      };

    /*****************************************************************************
    *
    * Event listeners for UI elements
    *
    ****************************************************************************/

    document.getElementById('butRefresh').addEventListener('click', function() {
        // Refresh all of the forecasts
        app.updateAll();
    });

    document.getElementById('butAdd').addEventListener('click', function() {
        // Open/show the add newdialog
        app.toggleAddDialog(true);
    });

    document.getElementById('butAddNode').addEventListener('click', function() {
      var key = document.getElementById('nodeName').value;
      var url = document.getElementById('nodeUrl').value;
      var user = document.getElementById('nodeUsername').value;
      var password = document.getElementById('nodePassword').value;
      var type = document.getElementById('selectNodeType').value;

      if (!app.selectedNodes) {
        app.selectedNodes = [];
      }

      app.getInfo(key, url, user, password, type);
      app.selectedNodes.push( 
        { key: key, url: url, user: user, type: type }
      );
      app.rpcPasswords[key] = password;
      app.saveSelectedNodes();

      app.toggleAddDialog(false);
    });

    document.getElementById('butAddCancel').addEventListener('click', function() {
      // Close the add new dialog
      app.toggleAddDialog(false);
    });

    app.toggleAddDialog = function(visible) {
      if (visible) {
        app.addDialog.classList.add('dialog-container--visible');
      } else {
        app.addDialog.classList.remove('dialog-container--visible');
      }
    };

    // creates a new card
    app.createCard = function(key) {
        var card = app.cardTemplate.cloneNode(true);
        card.classList.remove('cardTemplate');
        card.querySelector('.key').textContent = key;
        card.removeAttribute('hidden');
        app.container.appendChild(card);
        app.visibleCards[key] = card;
    };

    app.setRpcRequestHeaders = function(user, password, request) {
      var authHeader = 'Basic ' + btoa(user + ':' + password);
      request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      request.setRequestHeader("Authorization", authHeader);
      request.setRequestHeader('Accept', 'application/json');
    }

    app.updateCardBlockInfo = function(key, blockchaininfo) {
      var card = app.visibleCards[key];
      card.querySelector('.name').textContent = blockchaininfo.chain;
      card.querySelector('.blocks').textContent = blockchaininfo.blocks;
      var minutes = (Date.now()/1000.0 - blockchaininfo.mediantime)/60;
      card.querySelector('.last-block-time').textContent = minutes.toFixed(0) + " mins";
    };

    app.getAccountInfo = function(key, url, user, password) {    
      var request  = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            var response = JSON.parse(request.response);
            console.log(response.result);
            var card = app.visibleCards[key];
            card.querySelector('.balance').textContent = response.result;
          }
        }
      };
      request.open('POST', url, true);
      app.setRpcRequestHeaders(user, password, request);
      console.log('Calling RPC getbalance');
      request.send(JSON.stringify({"method":"getbalance","params":[], "id":1, "jsonrpc":2.0}));      
    };

    app.getNetworkInfo = function(key, url, user, password) {    
      var request  = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState === XMLHttpRequest.DONE) {
          if (request.status === 200) {
            var response = JSON.parse(request.response);
            console.log(response.result);
            var card = app.visibleCards[key];
            card.querySelector('.connections').textContent = response.result.connections;
          }
        }
      };
      request.open('POST', url, true);
      app.setRpcRequestHeaders(user, password, request);
      console.log('Calling RPC getnetworkinfo');
      request.send(JSON.stringify({"method":"getnetworkinfo","params":[], "id":1, "jsonrpc":2.0}));      
    };   

    app.getInfo = function(key, url, user, password, type) {    
        var request  = new XMLHttpRequest();
        request.onreadystatechange = function() {
          if (request.readyState === XMLHttpRequest.DONE) {
            if (request.status === 200) {
              var response = JSON.parse(request.response);
              console.log(response);

              // create card if it doesn't exist
              if (!app.visibleCards[key]) {
                app.createCard(key);
              }

              // Check if card needs to be updated based upon block height
              var card = app.visibleCards[key];
              var blocks = response.result.blocks;
              var cardLastUpdatedElem = card.querySelector('.card-last-updated');
              var cardBlocks = cardLastUpdatedElem.textContent;
              if (cardBlocks) {        
                // Bail if response doesn't have newer data
                if (blocks <= cardBlocks) {
                  return;
                }
              }          
              cardLastUpdatedElem.textContent = blocks;

              console.log("Type: " + type);
              if (type == app.nodeTypesEnum.Stratis) {
                card.style.backgroundColor = "#e6e6fa";
              } else {
                card.style.backgroundColor = "#fff2d9";
              }

              // update with blockchaininfo              
              app.updateCardBlockInfo(key, response.result);

              // update with account info
              app.getAccountInfo(key, url, user, password);

              // update with network info
              app.getNetworkInfo(key, url, user, password);

              // do any stratis specific stuff
              if (type == app.nodeTypesEnum.Stratis) {
                // TODO: Get staking info
              }

              // TODO: Where? multiple async above (maybe jquery.deferred)
              if (app.isLoading) {
                app.spinner.setAttribute('hidden', true);
                app.container.removeAttribute('hidden');
                app.isLoading = false;
              }
            }
          }
        };
        request.open('POST', url, true);

        app.setRpcRequestHeaders(user, password, request);
        console.log('Calling RPC getblockchaininfo');
        request.send(JSON.stringify({"method":"getblockchaininfo","params":[], "id":1, "jsonrpc":2.0}));
      }

    // Iterate all of the cards and attempt to get the latest forecast data
    app.updateAll = function() {
      var keys = Object.keys(app.visibleCards);
      keys.forEach(function(key) {
        var node = app.selectedNodes.find(function(node) { return node.key === key; });
        if (node) {
          app.getInfo(node.key, node.url, node.user, app.getPassword(node.key), node.type);
        }
      });
    };

    app.getPassword = function(key) {
      if (!app.rpcPasswords[key]){
        app.rpcPasswords[key] = prompt('Enter RPC Password for ' + key);        
      }
      return app.rpcPasswords[key];
    }

    app.saveSelectedNodes = function() {
      var selectedNodes = JSON.stringify(app.selectedNodes);
      localStorage.selectedNodes = selectedNodes;
    };

    /* Startup Code */
    app.selectedNodes = localStorage.selectedNodes;
    if (app.selectedNodes) {
      app.selectedNodes = JSON.parse(app.selectedNodes);
      app.selectedNodes.forEach(function(node) {
        app.getInfo(node.key, node.url, node.user, app.getPassword(node.key), node.type);
      });
    }
    else {
      app.spinner.setAttribute('hidden', true);
      app.isLoading = false;
      document.getElementById('nodeName').value = "Stratis";
      document.getElementById('nodeUrl').value = "http://127.0.0.1:16174";
      app.toggleAddDialog(true);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
               .register('./service-worker.js')
               .then(function() { console.log('Service Worker Registered'); });
    }
})();