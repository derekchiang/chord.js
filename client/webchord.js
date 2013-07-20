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

  function simpleClone(obj) {
    return JSON.parse(JSON.stringify(obj))
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
          orig: node
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

  function Chord(myPeerId) {
    if (!(this instanceof Chord)) return new Chord()

    var originId = 'the original id'
    var self = this

    var myPeerId = localStorage.getItem('peerId') || myPeerId ||
      generateRandomId()

    localStorage.setItem('peerId', myPeerId)

    this.node = {
      id: myPeerId,
      hash = hash(myPeerId)
    }

    this.finger = new Array(numBits)

    var rpc = new RPC(myPeerId, this)

    if (myPeerId === originId) {
      initializeOriginalNode()
    } else {
      chord.join({
        id: originId,
        hash: hash(originId)
      })
    }

    function initializeOriginalNode() {
      for (var i = 0; i < numBits; i++) {
        self.finger[i] = simpleClone(self.node)
      }

      self.successor = simpleClone(self.node)
      self.predecessor = simpleClone(self.node)
    }

    // Functions defined in the Chord paper

    this.join = function(peer) {
      return Q.fcall(function() {
        self.predecessor = null
        rpc.invoke(peer, 'findSuccessor', self.node)
          .then(function(successor) {
            self.successor = successor
          })
      })
    }

    this.stablize = function() {
      return Q.fcall(function() {
        rpc.invoke(self.successor, 'getPredecessor')
          .then(function(predecessor) {
            if ((predecessor.hash > self.node.hash) &&
              (predecessor.hash < self.successor.hash)) {
              self.successor = predecessor
            }
            rpc.invoke(self.successor, 'notify', self.node)
              .done()
          })
      })
    }

    this.notify = function(peer) {
      return Q.fcall(function() {
        if ((self.predecessor === null) ||
          ((peer.hash > self.predecessor.hash) &&
            (peer.hash < self.node.hash)))
          self.predecessor = peer
      })
    }

    this.fixFingers = function() {
      return Q.fcall(function() {
        var randomInt = Math.floor(Math.random() * numBits)
        self.findSuccessor(self.finger[i].start).then(function(successor) {
          self.finger[i].node = successor
        })
      })
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

    this.put = function(key, value) {
      return Q.fcall(function() {
        self.findSuccessor(key).then(function(successor) {
          return rpc.invoke(successor, 'localPut', key, value)
        }).done()
      })
    }

    // TODO: cache recently got values
    this.get = function(key) {
      var deferred = Q.defer()
      var hash = hash(key)
      self.findSuccessor(key).then(function(successor) {
        return rpc.invoke(successor, 'localGet', key)
      }).then(function(value) {
        deferred.resolve(value)
      }, function(err) {
        // log(err)
        // Try again
        setTimeout(function() {
          this.get(key).then(function(value) {
            deferred.resolve(value)
          })
        }, 1)
      })

      return deferred.promise
    }

    this.localGet = function(key) {
      return Q.fcall(function() {
        return localStorage.getItem(key)
      })
    }

    this.localPut = function(key, value) {
      return Q.fcall(function() {
        localStorage.setItem(key, value)
      })
    }

    // Stablization
    setInterval(function() {
      self.stablize()
      self.fixFingers()
    }, 1000)
  }

  window.Chord = Chord
}).call(this)