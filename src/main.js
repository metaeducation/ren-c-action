//
// File: %src/main.js
// Description: {Entry Point of the GitHub Action}
//
//=//// NOTICE ////////////////////////////////////////////////////////////=//
//
// Editing this file and committing it--either in the master repository or in
// your own clone--is insufficient to run it in the cloud as a GitHub Action.
// It must be compiled and run from the %dist/ directory.  See README.md
//
//=////////////////////////////////////////////////////////////////////////=//
//
// This is the entry point of the GitHub Action, because %main.js is named in
// the %/action.yml file as the `main:`.
//
// We unpack the parameters to the action to invoke narrower functions, and
// then repack its outputs.
//

//=//// Node.js Libraries //////////////////////////////////////////////////=//
//
// Install to package.json and node_modules e.g. `npm install @actions/core`
//
// GitHub interop functions:
// https://github.com/actions/toolkit
//

const core = require('@actions/core')
const github = require('@actions/github')
const get_cached_else_download = require('./cache').get_cached_else_download


//=//// TOP-LEVEL ASYNC run() FUNCTION /////////////////////////////////////=//
//
// In JavaScript, anytime you do something like a network request you have to
// yield control to the message pump...and then it calls you back with the
// result (or error object).
//
// To avoid having to process things in terms of callbacks, the `async/await`
// pattern gained popularity.  As long as all the functions on the call stack
// are asynchronous, they will be able to suspend themselves and resume...
// avoiding the need to separate out callbacks.
//
// But we're not "in an async function" when we start running this file, so
// we have to wrap our code inside of one...otherwise there'd be nowhere to
// catch any errors.
//
// https://stackoverflow.com/a/46515787
//

async function run() {
  try {

  //=//// READ INPUTS //////////////////////////////////////////////////////=//

    // Extract the `inputs` defined in the %/action.yml file
    // The step invoking the action provides these as `with:` properties
    //
    const script = core.getInput('script')

    // Beyond the `with:` parameters in the step, there is also information
    // associated with the "webhook" that triggered the workflow.  So if there
    // was a commit to a branch, you would be able to know the branch and
    // commit ID by looking in this JSON data.
    //
    // The inventory of properties you can get are here:
    // https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads
    //
    if (false) {
        const payload = JSON.stringify(github.context.payload, undefined, 2)
        console.log(`The event payload: ${payload}`)
    }

  //=//// DOWNLOAD INTERPRETER /////////////////////////////////////////////=//

    const exePath = await get_cached_else_download()

  //=//// RUN SCRIPT ///////////////////////////////////////////////////////=//

    console.log(`Running Script ${script}!`)

  //=//// WRITE OUTPUTS ////////////////////////////////////////////////////=//

    core.setOutput("path", exePath)

  } catch (error) {

    core.setFailed(error.message)

  }
}

console.log('RUNNING REN-C-ACTION')

run()  // call to kick off the top-level await
