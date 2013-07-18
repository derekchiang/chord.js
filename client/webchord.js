"use strict";

(function() {
  // Constants
  var numBits = 52;
  var max = 4503599627370496; // 2 to the power of 52

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

  function RPC(id, chord) {
    if (!(this instanceof RPC)) return new RPC()
    var self = this

    var peer = new Peer(id, {
      host: 'localhost',
      port: 9000
    })

    peer.on('connection', function(conn) {
      conn.on('data', function(data) {
        switch (data.type) {
          case 'rpc':
            chord[data.func].apply(chord, data.args).then(function(res) {
              conn.send({
                type: 'return',
                func: data.func,
                orig: chord.node,
                data: res
              })
            }).done()
            break
        }
      })
    })

    this.invoke = function(node, func) {
      var deferred = Q.defer()
      var args = [].slice.call(arguments, 2)

      var conn = peer.connect(node.id)
      conn.on('open', function() {
        conn.send({
          type: 'rpc',
          func: func,
          args: args,
          orig: node.id
        })
      })

      conn.on('data', function(data) {
        switch (data.type) {
          case 'return':
            deferred.resolve(data.data)
            break
        }
      })

      return deferred.promise
    }
  }

  // Webchord implementation

  function Chord() {
    if (!(this instanceof Chord)) return new Chord()

    var self = this;

    var myPeerId = localStorage.getItem('peerId')
    if (myPeerId === null) {
      myPeerId = generateRandomId()
      localStorage.setItem('peerId', myPeerId)
    }

    this.node = {
      id: myPeerId,
      hash = hash(myPeerId)
    }

    var rpc = new RPC(myPeerId, this);

    // Functions defined in the Chord paper

    function initFingerTable(peer) {
      rpc.invoke(peer, 'findSuccessor', [self.finger[0].start])
        .then(function(res) {
        self.finger[0].node = self.successor = res
        return rpc.invoke(self.successor, 'getPredecessor')
      }).then(function(res) {
        self.predecessor = res
        return rpc.invoke(self.successor, 'setPredecessor', self.node)
      }).then(function(res) {
        for (var i = 0; i < (m-1); i++) {
          if ((self.finger[i+1].start >= self.node.hash) &&
            (self.finger[i+1].start < self.finger[i].node.hash)) {
            self.finger[i+1].node = self.finger[i].node
          } else {
            rpc.invoke(peer, 'findSuccessor', self.finger[i+1].start)
              .then(function(res) {
              self.finger[i+1].node = res
            })
          }
        }
      }).done()
    }

    this.findSuccessor = function(hash) {
      var deferred = Q.defer()
      this.findPredecessor(hash).then(function(res) {
        deferred.resolve(res.successor)
      })
      return deferred.promise
    }

    this.findPredecessor = function(hash) {
      var n = self.node

      return (function findPredecessorLooper(n) {
        var deferred = Q.defer()
        if ((hash <= n.hash) || (hash > n.successor.hash)) {
          if (n.id == self.node.id) {
            // If it's self, just call it's own method
            self.closestPrecedingFinger(hash).then(function(res) {
              return findPredecessorLooper(res)
            })
          } else {
            rpc.invoke(n, 'closestPrecedingFinger', hash)
              .then(function(res) {
              return findPredecessorLooper(res)
            })
          }
        } else {
          deferred.resolve(n)
        }
        return deferred.promise
      })(self.node)
    }

    this.closestPrecedingFinger = function(hash) {
      return Q.fcall(function() {
        for (var i = m - 1; i >= 0; i--) {
          var fingerHash = self.finger[i].node.hash
          if ((fingerHash > self.node.hash) && (fingerHash < hash))
            return slef.finger[i].node
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
      var hash = hash(key)
      self.findSuccessor(hash, function(node)) {
        rpc.invoke({
          dest: node.id,
          func: 'localPut',
          args: [key, value],
          success: ret
        })
      }

      localStorage.setItem(key, value)
      if (ret !== undefined) ret()
    }

    this.get = function(key, ret) {
      var hash = hash(key)
      self.findSuccessor(hash, function(node)) {
        rpc.invoke({
          dest: node.id,
          func: 'localGet',
          args: [key],
          success: ret
        })
      }
    }

    this.localGet = function(key) {
      return localStorage.getItem(key)
    }

    this.localPut = function(key, value) {
      localStorage.setItem(key, value)
    }
  }

  window.Chord = Chord
}).call(this)