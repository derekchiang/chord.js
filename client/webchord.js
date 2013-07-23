"use strict"

;(function() {
  // Fancy and smart way to define classes
  // Details: https://github.com/javascript/augment
  Function.prototype.augment = function(body) {
    var base = this.prototype
    var prototype = Object.create(base)
    body.apply(prototype, Array.from(arguments, 1).concat(base))
    if (!Object.ownPropertyOf(prototype, "constructor")) return prototype
    var constructor = prototype.constructor
    constructor.prototype = prototype
    return constructor
  }

  ;(function(functProto) {
    var bind = functProto.bind
    var bindable = Function.bindable = bind.bind(bind)
    var callable = Function.callable = bindable(functProto.call)
    Object.ownPropertyOf = callable(Object.prototype.hasOwnProperty)
    Array.from = callable(Array.prototype.slice)
  }(Function.prototype))

  // Constants
  const NUM_BITS = 52
  const MAX = 4503599627370496 // 2 to the power of 52

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

  var RPC = Object.augment(function() {
    this.constructor = function(id, chord) {
      if (!(this instanceof RPC)) return new RPC()

      var self = this

      var peer = new Peer(id, {
        host: 'localhost',
        port: 9000
      })

      // Due to the limitations of PeerJS, we can't have multiple
      // connections between two peers at the same time; therefore
      // we need to have a connection pool to manage connections
      // TODO: as the implementation currently stands, if you `get`
      // a connection when it's still waiting to be opened, it will
      // be replaced by a new connection and wait to be opened again.
      // Potential source of bugs.
      this.connectionPool = new(function() {
        var pool = {}

        var self = this

        this.add = function(id, conn) {
          pool[id] = conn
        }

        this.get = function(id) {
          var deferred = Q.defer()

          if (pool[id]) {
            var conn = pool[id]
            if (conn.open) {
              deferred.resolve(conn)
            } else {
              conn.on('open', function() {
                deferred.resolve(conn)
              })
            }
          } else {
            var conn = peer.connect(id)
            self.add(id, conn)
            conn.on('open', function() {
              console.log('openning!')
              deferred.resolve(conn)
            })

            conn.on('close', function() {
              self.remove(conn.peer)
            })
          }

          return deferred.promise
        }

        this.remove = function(id) {
          if (pool[id]) {
            pool[id].close()
            delete pool[id]
          }
        }
      })()

      // TODO: think about how to deal with this connection...
      // use connectionPool or not?
      // Get ready to accept RPC calls
      peer.on('connection', function(conn) {
        console.log('getting a connection')
        conn.on('data', function(data) {
          console.log('receiving an RPC call: ' + data.func)
          switch (data.type) {
            case 'rpc':
              // Call the corresponding function
              console.log('invoking function: ' + data.func)
              console.log('with args: ' + JSON.stringify(data.args))
              chord[data.func].apply(chord, data.args).then(function(res) {
                // When a result is available, set it back
                if (res) console.log('sending back data: ' + res.toString())
                conn.send({
                  type: 'return',
                  func: data.func,
                  orig: chord.node,
                  data: res,
                  signature: data.signature
                })
                // TODO: figure out what's the best strategy for closing
                // connections
                // Comment out the following line for now
                // conn.close()
              }).done()
              break
          }
        })
      })
    }

    this.invoke = function(node, func) {
      // If node is for some reason null or undefined,
      // terminate the function
      if (isNull(node) || isUndefined(node)) return

      var deferred = Q.defer()
      var self = this

      // Get the actual arguments that will be passed to `func`
      var args = [].slice.call(arguments, 2)

      // Initialize connection
      console.log('connecting to: ' + node.id.toString())

      this.connectionPool.get(node.id).then(function(conn) {
        console.log('sending an RPC call: ' + func + ' to: ' + node.id.toString())

        // Used to identify this particular RPC
        var signature = generateRandomId()

        conn.send({
          type: 'rpc',
          func: func,
          args: args,
          orig: node,
          signature: signature
        })

        // Wait for return value
        conn.on('data', function(data) {
          if (data.signature === signature) {
            console.log('receiving data of type: ' + data.type)
            console.log(data.func)
            console.log('the data is ' + JSON.stringify(data.data))
            switch (data.type) {
              case 'return':
                deferred.resolve(data.data)
                // self.connectionPool.remove(node.id)
                break
            }
          }
        })
      }).done()

      return deferred.promise
    }
  })

  // Webchord implementation

  window.Chord = Object.augment(function() {
    // Define the id of the original node
    const originId = 'the original id'

    this.constructor = function(myPeerId) {
      // Detect if the user is calling Chord without `new`
      if (!(this instanceof Chord)) return new Chord()

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

      this.finger = new Array(NUM_BITS)
      for (var i = 0; i < NUM_BITS; i++) {
        this.finger[i] = {}
        this.finger[i].start = (this.node.hash + Math.pow(2, i)) % MAX
        this.finger[i].interval = Math.pow(2, i)
      }

      // Set up a RPC client that will be used later
      this.rpc = new RPC(myPeerId, this)

      // Initialization

      // For the original node only

      function initializeOriginalNode() {
        for (var i = 0; i < NUM_BITS; i++) {
          self.finger[i].node = simpleClone(self.node)
        }

        self.node.successor = simpleClone(self.node)
        // self.node.predecessor = simpleClone(self.node)
        self.node.predecessor = null
      }

      function initializeNormalNode() {
        // Questionable design: should we initialize finger
        // table this way?
        for (var i = 0; i < NUM_BITS; i++) {
          self.finger[i].node = simpleClone(self.node)
        }
      }

      if (myPeerId === originId) {
        initializeOriginalNode()
      } else {
        // If it's not the original node, join using the original node
        initializeNormalNode()
        self.join({
          id: originId,
          hash: hashFunc(originId)
        })
      }

      var joinInterval = setInterval(function() {
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
            console.log(self.node.successor)
            console.log(self.node.predecessor)
          }, 5000)
        }
      }, 5000)
    }

    // Functions defined in the Chord paper
    this.join = function(peer) {
      var self = this
      return Q.fcall(function() {
        self.node.predecessor = null
        self.rpc.invoke(peer, 'findSuccessor', self.node.hash)
          .then(function(successor) {
            self.node.successor = successor
          }).done()
      })
    }

    this.stablize = function() {
      var self = this
      return Q.fcall(function() {
        self.rpc.invoke(self.node.successor, 'getPredecessor')
          .then(function(predecessor) {
            if ((!isNull(predecessor)) && ((predecessor.hash > self.node.hash)
              && (predecessor.hash < self.node.successor.hash))) {
              self.node.successor = predecessor
            }
            self.rpc.invoke(self.node.successor, 'notify', self.node)
              .done()
          }).done()
      })
    }

    this.notify = function(peer) {
      var self = this
      return Q.fcall(function() {
        if ((self.node.predecessor === null) ||
          ((peer.hash > self.node.predecessor.hash) &&
            (peer.hash < self.node.hash))) {
          self.node.predecessor = peer

          // When the original node starts itself it sets its
          // successor to itself; but when another node joins,
          // it should set its succcesor to that node.  From
          // this point on, the system will work exactly as
          // described in the Chord paper.
          if (self.node.successor.id === self.node.id) {
            self.node.successor = peer
          }
        }
      })
    }

    this.fixFingers = function() {
      var self = this
      return Q.fcall(function() {
        var randomInt = Math.floor(Math.random() * NUM_BITS)
        self.findSuccessor(self.finger[randomInt].start).then(function(successor) {
          self.finger[randomInt].node = successor
        })
      })
    }

    this.findSuccessor = function(hash) {
      var self = this
      var deferred = Q.defer()
      self.findPredecessor(hash).then(function(res) {
        deferred.resolve(res.successor)
      })
      return deferred.promise
    }

    this.findPredecessor = function(hash) {
      var self = this
      var deferred = Q.defer()

      // TODO: this algorithm is slightly modified to avoid an infinite loop
      // when there is only one node in the whole network; reconsider plz
      var n = self.node;
      (function findPredecessorLooper() {
        if ((hash <= n.hash) || (hash > n.successor.hash)) {
          if (n.id == self.node.id) {
            // If it's self, just call it's own method
            self.closestPrecedingFinger(hash).then(function(res) {
              if (n.id === res.id)
                deferred.resolve(n)
              else {
                n = res
                findPredecessorLooper()
              }
            })
          } else {
            self.rpc.invoke(n, 'closestPrecedingFinger', hash)
              .then(function(res) {
                if (n.id === res.id)
                  deferred.resolve(n)
                else {
                  n = res
                  findPredecessorLooper()
                }
              }).done()
          }
        } else {
          deferred.resolve(n)
        }
      })()

      return deferred.promise
    }

    this.closestPrecedingFinger = function(hash) {
      var self = this
      return Q.fcall(function() {
        for (var i = NUM_BITS - 1; i >= 0; i--) {
          var fingerHash = self.finger[i].node.hash
          if ((fingerHash > self.node.hash) && (fingerHash < hash))
            return self.finger[i].node
        }
        return self.node
      })
    }

    this.getPredecessor = function() {
      var self = this
      return Q.fcall(function() {
        return self.node.predecessor
      })
    }

    this.put = function(key, value) {
      var self = this
      var hash = hashFunc(key)
      return Q.fcall(function() {
        self.findSuccessor(hash).then(function(successor) {
          return self.rpc.invoke(successor, 'localPut', key, value)
        }).done()
      })
    }

    // TODO: cache recently got values
    this.get = function(key) {
      var self = this
      var deferred = Q.defer()
      var hash = hashFunc(key)
      self.findSuccessor(key).then(function(successor) {
        return self.rpc.invoke(successor, 'localGet', key)
      }).then(function(value) {
        deferred.resolve(value)
      }, function(err) {
        // Try again
        setTimeout(function() {
          this.get(key).then(function(value) {
            deferred.resolve(value)
          })
        }, 1)
      }).done()

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
  })
}).call(this)