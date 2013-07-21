"use strict"

;
(function() {
  // Constants
  var numBits = 52;
  var max = 4503599627370496; // 2 to the power of 52

  // Some utility functions

  function isNull(obj) {
    return obj === null
  }

  function isUndefined(obj) {
    return typeof(obj) === 'undefined'
  }

  function generateRandomId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
      function(c) {
        var r = Math.random() * 16 | 0,
          v = c == 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
      })
  }

  function hashFunc(data) {
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

    // Get ready to accept RPC calls
    peer.on('connection', function(conn) {
      conn.on('data', function(data) {
        switch (data.type) {
          case 'rpc':
            // Call the corresponding function
            chord[data.func].apply(chord, data.args).then(function(res) {
              // When a result is available, set it back
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
      // If node is for some reason null or undefined,
      // terminate the function
      if (isNull(node) || isUndefined(node)) return

      var deferred = Q.defer()

      // Get the actual arguments that will be passed to `func`
      var args = [].slice.call(arguments, 2)

      // Initialize connection
      var conn = peer.connect(node.id)

      // Send the RPC call
      conn.on('open', function() {
        conn.send({
          type: 'rpc',
          func: func,
          args: args,
          orig: node
        })
      })

      // Wait for return value
      conn.on('data', function(data) {
        switch (data.type) {
          case 'return':
            deferred.resolve(data.data)
            conn.close()
            break
        }
      })

      return deferred.promise
    }
  }

  // Webchord implementation

  function Chord(myPeerId) {
    // Detect if the user is calling Chord without `new`
    if (!(this instanceof Chord)) return new Chord()

    // Define the id of the original node
    var originId = 'the original id'

    // To avoid confusion
    var self = this

    // If given a peer id, use it; otherwise generate one in random
    // TODO: in production, you might want to do:
    // var myPeerId = myPeerId || localStorage.getItem('peedId')
    //    || generateRandomId()
    // Need to think about this later
    var myPeerId = myPeerId || generateRandomId()

    // TODO: maybe use in production
    // localStorage.setItem('peerId', myPeerId)


    // Set up initial state
    this.node = {
      id: myPeerId,
      hash: hashFunc(myPeerId)
    }

    this.finger = new Array(numBits)
    for (var i in this.finger) {
      this.finger[i].start = (this.node.hash + Math.pow(2, i)) % max
      this.finger[i].interval = Math.pow(2, i)
    }

    // Set up a RPC client that will be used later
    var rpc = new RPC(myPeerId, this)

    // Functions defined in the Chord paper

    this.join = function(peer) {
      return Q.fcall(function() {
        self.node.predecessor = null
        rpc.invoke(peer, 'findSuccessor', self.node.hash)
          .then(function(successor) {
            self.node.successor = successor
          })
      })
    }

    this.stablize = function() {
      return Q.fcall(function() {
        rpc.invoke(self.node.successor, 'getPredecessor')
          .then(function(predecessor) {
            if ((predecessor.hash > self.node.hash) &&
              (predecessor.hash < self.node.successor.hash)) {
              self.node.successor = predecessor
            }
            rpc.invoke(self.node.successor, 'notify', self.node)
              .done()
          })
      })
    }

    this.notify = function(peer) {
      return Q.fcall(function() {
        if ((self.node.predecessor === null) ||
          ((peer.hash > self.node.predecessor.hash) &&
            (peer.hash < self.node.hash)))
          self.node.predecessor = peer
      })
    }

    this.fixFingers = function() {
      return Q.fcall(function() {
        var randomInt = Math.floor(Math.random() * numBits)
        self.findSuccessor(self.finger[randomInt].start).then(function(successor) {
          self.finger[randomInt].node = successor
        })
      })
    }

    this.findSuccessor = function(hash) {
      var deferred = Q.defer()
      self.findPredecessor(hash).then(function(res) {
        deferred.resolve(res.successor)
      })
      return deferred.promise
    }

    this.findPredecessor = function(hash) {
      var deferred = Q.defer()

      ;
      (function findPredecessorLooper(n) {
        if ((hash <= n.hash) || (hash > n.successor.hash)) {
          if (n.id == self.node.id) {
            // If it's self, just call it's own method
            self.closestPrecedingFinger(hash).then(function(res) {
              findPredecessorLooper(res)
            })
          } else {
            rpc.invoke(n, 'closestPrecedingFinger', hash)
              .then(function(res) {
                findPredecessorLooper(res)
              })
          }
        } else {
          deferred.resolve(n)
        }
      })(self.node)

      return deferred.promise
    }

    this.closestPrecedingFinger = function(hash) {
      return Q.fcall(function() {
        for (var i = m - 1; i >= 0; i--) {
          var fingerHash = self.finger[i].node.hash
          if ((fingerHash > self.node.hash) && (fingerHash < hash))
            return self.finger[i].node
        }
      })
    }

    this.getPredecessor = function() {
      return Q.fcall(function() {
        return self.node.predecessor
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
      var hash = hashFunc(key)
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

    // Initialization

    // For the original node only

    function initializeOriginalNode() {
      for (var i = 0; i < numBits; i++) {
        self.finger[i] = simpleClone(self.node)
      }

      self.node.successor = simpleClone(self.node)
      self.node.predecessor = simpleClone(self.node)
    }

    if (myPeerId === originId) {
      initializeOriginalNode()
    } else {
      // If it's not the original node, join using the original node
      self.join({
        id: originId,
        hash: hashFunc(originId)
      })
    }

    joinInterval = setInterval(function() {
      // In theory, `join` should be called only once.  However, it's
      // possible that when the first `join` is called, the RPC client
      // has not been started yet, and therefore `join` will fail.
      // To avoid this, we keep calling `join` until successor is set
      if (isUndefined(self.node.successor)) {
        self.join({
          id: originId,
          hash: hashFunc(originId)
        })
      } else {
        clearInterval(joinInterval)

        // Start stablization
        setInterval(function() {
          self.stablize()
          self.fixFingers()
        }, 1000)
      }
    }, 1000)
  }

  window.Chord = Chord
}).call(this)