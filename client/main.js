"use strict";

(function() {
  var chord = new Chord()

  $('#put-button').click(function() {
    var key = $('#put-key-input').val()
    var value = $('#put-value-input').val()
    chord.put(key, value).then(function() {
      $('#get-key-input').val(key)
    })
  })
  $('#get-button').click(function() {
    var key = $('#get-key-input').val()
    chord.get(key).then(function(data) {
      $('#get-value-input').val(data)
    })
  })

  var peer = new Peer('some-id', {
    host: 'localhost',
    port: 9000
  });
}).call(this)