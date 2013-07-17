"use strict";

(function() {
  var chord = new window.Chord()
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

  var peer = new Peer('some-id', {
    host: 'localhost',
    port: 9000
  });
  peer.on('connection', function(conn) {
    conn.on('data', function(data) {
      console.log('Got data:', data);
    });
  });
  var conn = peer.connect('some-id');
  conn.on('open', function() {
    conn.send('Hello world!');
  });
}).call(this)