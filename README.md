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

[1]: https://github.com/actions/toolkit/tree/main/packages/tool-cache


## Inputs

### `script`

Optional script code to run in the interpreter.  It accomplishes this by taking
the code from the YAML and writing it to a file in the `$RUNNER_TEMP` directory
and executing that.

*(While this facility is currently modest and 

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
