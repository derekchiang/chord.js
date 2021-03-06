# chord.js

`chord.js` is a peer-to-peer distributed hash table, built for modern browsers.

## Introduction

`chord.js` provides two operations:

```js
chord.put('key', value)
```

and:

```js
chord.get('key').then(function(value) {
  // do whatever
})
```

And the beauty of it?  All browsers can `get` the values that any browser `put`, **all without a centralized database**.  Indeed, all key-value pairs are spread across browsers.  And make no mistake: all data are transferred directly between browsers.

What you can do with `chord.js` is limited only by your imagination.  [PeerCDN](https://peercdn.com/) could be implemented on top of it.  Browser games could be implemented using it, without needing any databases.  And so forth.

`chord.js` uses two of the latest web technologies: [WebRTC](http://en.wikipedia.org/wiki/WebRTC) (using [PeerJS](http://peerjs.com/)) and [localStorage](http://www.w3schools.com/html/html5_webstorage.asp).  The underlying algorithm is [Chord](http://pdos.csail.mit.edu/papers/chord:sigcomm01/chord_sigcomm.pdf), therefore the name.

## Status

It's working already, but there are still a lot to be done.  See the TODO list for details.

## Run the sample app

You will need Firefox 22+ or Chrome 26+.  IE 11+ will most likely work, although it hasn't been tested against.  Not sure about Safari and Opera.

To run it on a single machine:

1. Clone this repo and `cd` into it
2. `npm install`
3. `cd server/` and `npm install`
4. From the base directory: `node server.js`
5. `node server/bin/peerjs --port=9000`
6. Open a private browser window and point it to `localhost:8000/index-for-original.html`
7. Open any number of private browser windows and point them to `localhost:8000`
8. Wait for about 10 seconds for the nodes to initialize
9. Use the UI to put/get values.

To run it on multiple machines is basically the same.  You can figure this out.

## FAQ

* Why do I need to run the PeerJS server?

The PeerJS server is used for [handshake](https://en.wikipedia.org/wiki/Handshaking) only.  Once a connection is established between two browsers, they will send data to each other directly.  Checkout [PeerJS](http://peerjs.com/) for details.

This also technically implies that only browsers using the same PeerJS server for handshakes can talk to each other.

* How many peers (browsers) does chord.js support?

`chord.js` is an implementation of the Chord algorithm, which has a provable `O(log n)` runtime performance.

## TODO

* Clean up the code.
* Add a replication mechanism.
* Write tests.
* Work out the best way to manage connections.
* Benchmark.
* Optimize the startup process.
* Hash K-V pairs, for security reasons.
* Figure out the right rate to fix finger tables.

## License

[MIT](http://opensource.org/licenses/MIT).