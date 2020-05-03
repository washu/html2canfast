html2canfast
===========

https://codesandbox.io/s/tender-river-ifjlm?file=/src/index.js


#### What is html2canfast? ####

html2canfast is an experimental version of [html2canvas](https://github.com/niklasvh/html2canvas). As it is a fork of html2canvas, it derives all the syntax and functionality from it, but offers further features, specialized for performance improvements.


### How does it work? ###

html2canfast adds two new (optional) options: renderName and replaceSelector.
If you plan to take multiple screenshots of the same element, you can enter the 'fast mode', by passing in both these options.
The renderName is an arbitrary key, which is used to, so to say, cache the created container, so it can be accessed in subsequent screenshots, which means html2canfast is only faster on 1+ screenshots.
The replaceSelector is the selector for the element you wish to screenshot.
html2canvas works by creating an iframe of the complete document on each screenshot, which includes having to request all the images, script, links etc. embedded on your site.
This is, for some purposes, extremely inefficient.
html2canfast 'caches' this iframe, so that it doesn't have to be re-created on each screenshot.

### Example ###
You have a game, and want to take 1+ screenshots or the game screen, with the selector '#game'.
You decide to use the key: 'game-screen'.

    const gameScreen = document.getElementById('#game');

    html2canvas(gameScreen, {
        renderName: 'game-screen',
        replaceSelector: '#game',
        removeContainer: false
    }).then(function(canvas) {
        document.body.appendChild(canvas);
    });

It is crucial to note, that the renderName 'game-screen', should from now on only be used to capture screenshots or the '#game' element, as html2canfast replaces this selector in the 'cached' container.
Another note, of the utmost importance is that you **must** pass in the removeContainer option as false. Failing to do so will result in now performance improvements.

### How much faster is it? ###
How much faster html2canfast is, depends mostly on two variables: the overall size (meaning number of elements) of the webpage, and the content size of the external resources (images etc.) embedded on that webpage.
With that being said, the performance can be ~10000% or 100 times, faster than html2canvas.
Checkout the [comparison](https://codesandbox.io/s/tender-river-ifjlm?file=/src/index.js)!


### Installation ###

Available on npm [html2canfast](https://www.npmjs.com/package/html2canfast)

Install:

    $ npm i html2canfast
