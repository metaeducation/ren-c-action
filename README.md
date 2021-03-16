> IMPORTANT: While GitHub Actions look like JavaScript you could fork and try
> variants of your own, there is some overhead involved.  See %BUILDING.md for a
> description of the necessary workflow. 


# Install and/or Invoke Ren-C With a GitHub Action

This is a JavaScript-based GitHub Action which will install a Ren-C executable
appropriate for the platform of your GitHub container.  It can also run
some Ren-C code that you inline directly into your workflow YAML...just like
shell code in the `run:` tag of a step.

The action can be run many times, but will only download the interpreter the
first time.  It uses the GitHub Actions [`tool-cache`][1] NPM package.  Hence
the installation will be under the `$RUNNER_TOOL_CACHE` environment variable,
for instance `/opt/hostedtoolcache/ren-c/3.0.0/x64/r3`

While the executable is added to the path via GitHub Actions `core.addPath()`
facility, you can also retrieve the exact path as one of the action outputs.

As an added capability, this same GitHub Action can use web automation of a
local Firefox instance to run script code in the WebAssembly build.  The
"Marionette" driver is used to feed the code as keystrokes to the browser,
running against hosted builds of the Web REPL.

[1]: https://github.com/actions/toolkit/tree/main/packages/tool-cache


## Inputs

### `script`

Optional script code to run in the interpreter.  It accomplishes this by taking
the code from the YAML and writing it to a file in the `$RUNNER_TEMP` directory
and executing that.

*(While this facility is currently modest and just runs the code as-is, there
are ambitions for it to be used with configurations that would make a dialect
context, so that one could immediately be jumped into a domain-specific tool
but still using this same GitHub Action for installation and caching.)*

### `commit`

This is the GitHub short hash of the commit to use.  It must be a deployed
build (but not necessarily a "greenlit" build, which facilitates the usage of
ren-c-action to do testing of a new build to see if it's worth of being marked
as valid).

### `web` (`true` or `false`, default is `false`)

Run script code in the online version of the interpreter, by means of browser
automation.  This feature currently only works on Ubuntu hosts, and uses the
"Marionette" driver for controlling Firefox via WebSockets.

### `timeout` (integer number of seconds)

A timeout can already be set on individual GitHub steps via `timeout_minutes:`
However, interactions with the web build through the Marionette driver for
Firefox offer a timeout facility in milliseconds.  For the moment this is kept
due to being more granular, but it only applies if `web: true`

### `checked` (`true` or `false`, default is `false`)

Whether to use an instrumented build of the interpreter or not (e.g. a "debug"
build).  These are bigger and slower, but they help find bugs.  You should run
the checked build if at all possible, and any bug reports should be filed with
what output the checked build gives on the situation.


## Outputs

### `path`

Full path where the r3 executable was installed.


## Example usage

> !!! This action is being developed right now and does not have a published
> version stamp yet.  For the moment, the `release` branch is being used, and
> is often force-pushed.  A formal v1.0 tag will be published as soon as that
> makes sense.

Plain installation, no script:

    name: Install The Interpreter
    uses: actions/ren-c-action@release

    name: Demonstrate Usage 
    run: |
       r3 --do "print {Executable is in the PATH}" 

Install and execute script code:

    uses: actions/ren-c-action@release
    with:
      script: |
        print {== Hello From R3 HTTPS Read Test! ==}
        parse as text! read https://example.com [
            thru <h1> copy header: to </h1> to end
        ] else [
            fail "Couldn't Capture Page Title"
        ]
        assert [header = "Example Domain"]
        print ["Succeeded:" header]

Install and retrieve path:

    name: Install The Interpreter
    id: install-r3
    uses: actions/ren-c-action@release

    name: Echo Installation Path
    run: |
      echo "R3 Installed At ${{ steps.install-r3.outputs.path }}"
