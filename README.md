# ComportexViz

# THIS IS A HACK BRANCH. IT WILL NOT BE MERGED.

A web-based visualization layer for
[Comportex](http://github.com/nupic-community/comportex/).

See it in action in [the online demos](https://nupic-community.github.io/comportexviz/).

For original motivation see [this blog
post](http://floybix.github.io/2014/07/11/visualization-driven-development-of-the-cortical-learning-algorithm/).

## The Runner

ComportexViz runs HTM models from the browser with interactive
controls. The model state from recent timesteps is kept, so you can step
back in time. You can inspect input values, encoded input bits, and the
columns that make up cortical region layers. Within a column you can inspect
cells and their distal dendrite segments. Feed-forward and distal synapses
can be shown.

Kept timesteps are shown in a row at the top of the display.
Below that, the blocks represent input fields (squares) and
layers of cortical columns (circles). Depending on the display mode,
these may be shown in 2D grids from a single time step, or as one
vertical line per timestep, allowing several time steps to be shown
in series. Also, summarised time series are shown in the 'plots' tab.

ComportexViz can run HTM models:

- Inside the browser
- On a remote / localhost server

## The Notebook

ComportexViz interactive visualizations are also available in notebook
form, similar to IPython Notebook or Mathematica. It builds on
[Gorilla REPL](https://github.com/JonyEpsilon/gorilla-repl).

The notebook:

- Is a fun-filled way to drive and present HTM models
- Is a launchpad for ComportexViz runners
- Is [built for blogging](https://github.com/nupic-community/comportexviz/wiki/Putting-notebooks-on-the-web).
  Interactive graphics are saved as images in the state that you left them.

## Usage

Get [Leiningen](http://leiningen.org/) first.

Clone [Comportex](http://github.com/nupic-community/comportex/), and
install (this command installs to your local Maven repository,
`~/.m2`. Once we make a release this step will not be needed.):

```
cd comportex
lein install
```

Clone ComportexViz, and then build it:

```
cd comportexviz
lein do clean, cljsbuild once demos
```

Start a REPL:

```
lein repl
```

From the REPL, start a notebook:

```clojure
(start-notebook)
```

You can now launch it in a web browser. The notebook will show you how
to launch your own ComportexViz runner.


## Online demos

To host [the online demos](https://nupic-community.github.io/comportexviz/) locally,
do a `cljsbuild`, as above.

Now open `public/demos/*.html` in a web browser.
Each HTML page loads the corresponding model defined
in `examples/demos/comportexviz/demos/`.


## License

Copyright © 2015 Marcus Lewis, Felix Andrews and contributors.
Copyright © 2014 Felix Andrews and contributors.

Distributed under your choice of
* the Eclipse Public License, the same as Clojure.
* the GNU Public Licence, Version 3 http://www.gnu.org/licenses/gpl.html, the same as NuPIC.
