"use strict";

(function() {
  window.Chord = function(id) {
    this.put = function(key, value, ret) {
      localStorage.setItem(key, value)
      if (ret !== undefined) ret()
    }

    this.get = function(key, ret) {
      ret(localStorage.getItem(key))
    }
  }
}).call(this)