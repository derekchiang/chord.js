"use strict";

(function() {
  var chord = new window.Chord('derek')
  $('#put-button').click(function() {
    var key = $('#put-key-input').val()
    var value = $('#put-value-input').val()
    chord.put(key, value, function() {
      $('#get-key-input').val(key)
    })
  })
  $('#get-button').click(function() {
    var key = $('#get-key-input').val()
    chord.get(key, function(data) {
      $('#get-value-input').val(data)
    })
  })
}).call(this)