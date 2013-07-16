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

  // Webchord implementation
  window.Chord = function() {
    var myPeerId = localStorage.getItem('peerId')
    if (myPeerId === null) {
      myPeerId = generateRandomId()
      localStorage.setItem('peerId', myPeerId)
    }

    $.get('/api/1/getPeers', function(peers) {
      for (p in peers) {
        
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