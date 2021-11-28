# Building (or Forking) The `ren-c-action` Yourself

GitHub Actions can be containers or Node.js programs that run inside the
workflow's existing container.  The container form only works on Linux.  Since
ren-c-action wants to work on all platforms GitHub supports, it has to be
written as Node.js JavaScript.

The metadata describing the action is in %action.yml, which describes the
inputs and outputs, and points to the source file to act as the "main".

Our source entry point is %src/main.js, and that includes other files in %src.
This code has to call into Node.js modules in order to get basic functionality
like reading and writing the filesystem.  The modules used are described in
%package.json, and installed in the %node_modules/ directory.

However, it is considered a bad practice to commit `%node_modules/` into your
source repository.  This means when you `git clone` the ren-c-action project,
there will be no support code required by the code in `%src/`.  So if you
try to run the code manually with:

    node src/main.js

You will get a complaint that it cannot find modules like `core` that it
expects are installed.

GitHub itself suffers the same problem if it tries to run the main branch of
the action, where there are no `node_modules` available.  So you'd get a
failure with:

    name: This Would Fail Saying It Can't Find core
    uses: metaeducation/ren-c-action@master

## Why Not Just Commit `node_modules` in the Main Branch?

It might seem to make things easier, if you could make small patches to the
code in %src/ in master (or your own fork) and the resulting commit could be
used directly by GitHub Actions.

Here are the reasons not to do so:

* Modules encompass both develop-time tools as well as runtime tools.  Not only
  are the develop-time tools not necessary to be available when the action runs
  on a GitHub container, but they could be native executables committed from
  the platform you developed and committed `node_modules` from, not the
  platform the container is running.

* The runtime modules are large and can contain excessive amounts of functions
  that aren't used at all by the action.  A compilation process can prune that
  down.

* Doing things differently from the way other GitHub Actions do it can create
  a bad impression, as well as make it harder for people who know how other
  GitHub Actions work to tell what's going on.

So basically, you need to have Node.js and npm installed to test changes to
the script.

## Running The Action Locally

If you want to run the action locally, you need to make sure you have the
`node_modules` installed with npm.  Then you need environment variables set for
RUNNER_TEMP and RUNNER_TOOL_CACHE.  Here's the basic idea for Linux:

    sudo apt install nodejs
    sudo apt install npm

    git clone https://github.com/metaeducation/ren-c-action
    cd ren-c-action

    npm install

    # If on a virtualBox Shared Folder with no symlinks, try:
    #
    #     npm install --no-bin-links
    #
    # https://stackoverflow.com/questions/21425980/

    export RUNNER_TEMP=/tmp
    export RUNNER_TOOL_CACHE=/tmp

    node src/main.js

You can tweak the code directly to edit in parameters like the `script`, which
may be easier than figuring out how to pass it as parameters.

## Building For Release

Rather than put the `node_modules` on a separate branch, we follow the idea
of using the `ncc` compiler to glom together just the JavaScript that is
needed and put it into %dist/index.js.

The NCC compiler documentation:

  https://www.npmjs.com/package/@vercel/ncc

To install it globally:

    sudo npm i -g @vercel/ncc

To build:

    ncc build src/main.js --license licenses.txt

This more streamlined file is what the %action.yml points to.  Once local
testing is complete, this must be done and pushed to the release branch in
order for GitHub to be able to run the action.
