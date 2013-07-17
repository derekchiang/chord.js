"use strict";

(function() {
  // Constants
  var numBits = 52
  var max = 4503599627370496 // 2 to the power of 52

  // Some utility functions
  function generateRandomId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
      function(c) {
        var r = Math.random() * 16 | 0,
          v = c == 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
      })
  }

  function hash(data) {
    // Get the first 13 digits of hex -- equivalent to getting a 52-bit binary
    return parseInt(CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex).substring(0, 13), 16)
  }

  // RPC implementation using peer.js
  function RPC() {

  }

  var rpc = new RPC()

  // Webchord implementation
  window.Chord = function() {
    var self = this;

    var myPeerId = localStorage.getItem('peerId')
    if (myPeerId === null) {
      myPeerId = generateRandomId()
      localStorage.setItem('peerId', myPeerId)
    }

    function initFingerTable(destID) {
      self.finger[0].node
      rpc.invoke({
        dest: destID,
        func: 'findSuccessor',
        args: [self.finger[0].start],
        success: function(res) {
          self.finger[0].node = self.successor = res
          rpc.invoke({
            dest: self.successor.id,
            func: 'getPredecessor',
            args: [],
            success: function(res) {
              self.predecessor = res
              rpc.invoke({
                dest: self.successor.id,
                func: 'setPredecessor',
                args: [{id: self.id, hash: self.hash}],
                success: function(res) {
                  (function fillFingerTable(i) {
                    if ((finger[i+1].start < finger[i].node.hash) &&
                      (finger[i+1].start >= self.hash)) {
                      finger[i+1].node = finger[i].node
                      if (i < m) fillFingerTable(i+1)
                    } else {
                      rpc.invoke({
                        dest: destID,
                        func: 'findSuccessor',
                        args: [self.finger[i+1].start],
                        success: function(res) {
                          self.finger[i+1].node = res
                          if (i < m) fillFingerTable(i+1)
                        }
                      })
                    }
                  })(0)
                }
              })
            }
          })
        }
      })
    }

    $.get('/api/1/getPeers', function(peers) {
      for (var p in peers) {
        rpc.invoke('initializeFingerTable', p, function(data) {

        })
      }
    })

    this.put = function(key, value, ret) {
      localStorage.setItem(key, value)
      if (ret !== undefined) ret()
    }

    this.get = function(key, ret) {
      ret(localStorage.getItem(key))
    }
  }
}).call(this)