//
// src/web-invoke.js
//
//=//// NOTICE ////////////////////////////////////////////////////////////=//
//
// Editing this file and committing it--either in the master repository or in
// your own clone--is insufficient to run it in the could as a GitHub Action.
// It must be compiled and run from the %dist/ directory.  See BUILDING.md
//
//=////////////////////////////////////////////////////////////////////////=//
//
// If the user requested their script to be run in the Wasm version of the
// interpreter on the web, then this code will use the Marionette driver
// to speak to Firefox to do that execution.
//
// https://firefox-source-docs.mozilla.org/python/marionette_driver.html
//
// The Marionette httpd server for control exists only in Firefox (with a
// default port 2828) and is only enabled if you use `-marionette`.
//
// https://vakila.github.io/blog/marionette-act-i-automation/
//
// Comparable-but-incompatible APIs to control running browsers exist for
// Chrome and others.  The W3C's "WebDriver" initiative standardizes an "ODBC
// for browser control" which translates a common API into calls with plugins
// for each particular browser.  The layer is bulky and is typically used with
// "Selenium" which is even bulkier.  To be lighter we just use Python with
// raw Marionette.
//
// !!! WebSocket support in Ren-C would allow avoiding this Python usage.
// It is "planned for the future".  :-/
//
// !!! This code was initally part of a dedicated test, run on a Linux host and
// just testing basic interactivity of the web REPL.  The hope is to
// generalize its function over time, so that any web-based project written
// in Ren-C could make use of it.
//


// Used for logging via `core.info` (as opposed to console.log)
// https://github.com/actions/toolkit/tree/main/packages/core
const core = require('@actions/core')

// Needed to invoke `chmod +x` on Linux/Mac to make the downloaded r3 runnable
// https://github.com/actions/toolkit/tree/main/packages/exec
const exec = require('@actions/exec')

// https://github.com/actions/toolkit/tree/main/packages/tool-cache
const tc = require('@actions/tool-cache')

// https://github.com/actions/toolkit/tree/main/packages/tool-cache
const io = require('@actions/io')

// For simplicity we go ahead and make the screenshot artifact available
// https://github.com/actions/toolkit/tree/master/packages/artifact
const artifact = require('@actions/artifact')

// For joining paths together in a platform independent way, correcting slashes
// https://nodejs.org/api/path.html#path_path
const path = require('path')

// Needed for detecting if we are on Windows, Linux, MacOS
// https://nodejs.org/api/os.html#os_os
const os = require('os')

// The Node.js FileSystem APIs are "promisified" in v11+
const fs = require('fs')
const fsPromises = fs.promises

const ok = require('assert').ok

const uuidV4 = require('uuid').v4

// This function for getting the temporary directory is not exported
// https://github.com/actions/toolkit/issues/518
//
function _getTempDirectory() {
  const tempDirectory = process.env['RUNNER_TEMP'] || ''
  ok(tempDirectory, 'Expected RUNNER_TEMP to be defined')
  return tempDirectory
}


async function web_invoke(script, commit_short, timeout, screenshot)
{
    const verbose = true

    // It can be helpful when debugging locally to see what's happening in
    // the browser, by not running it headlessly.
    //
    // !!! The GITHUB_ACTIONS environment variable is `true` when being run
    // in the GitHub Actions container, as opposed to via `node src/main.js`
    // Use this to default to not being headless?
    //
    const headless = true

    if (verbose)
        await exec.exec('sudo apt install net-tools')  // for `netstat` command

    // Use pip (Python Install Package) to get the Firefox Marionette driver
    // for controlling the browser from Python.
    //
    await exec.exec('pip3 install marionette-driver --user')

    // Create a Firefox profile in the temp directory that we can tweak
    // (as finding the default one's auto-generated name is a pain)
    //
    const ffprofileDir = path.join(_getTempDirectory(), 'ff-profile')
    await io.mkdirP(ffprofileDir)
    await exec.exec('firefox', [  // synchronous execution, just for profile
        '-headless',  // always run this config generation headlessly
        '-CreateProfile', `ff-profile ${ffprofileDir}`
    ])

    // The way to set `about:config` flags in preferences is via %user.js
    //
    // https://askubuntu.com/a/313662/137769
    // http://kb.mozillazine.org/User.js_file
    //
    // The Marionette port for control defaults to 2828, and can be overridden
    // on the command line by `--marionette-port <port>`.  But to show another
    // place to set it, here's the profile setting.
    //
    // !!! At one time we turned on shared_memory for the pthreads build.  But
    // the pthreads build has been scrapped.  There's not really a need to turn
    // shared memory off, but do it just to show another setting...and that we
    // don't require it.
    //
    const userjsPath = path.join(ffprofileDir, 'user.js')
    core.info(`Writing Firefox Configuration to ${userjsPath}`)
    await fsPromises.writeFile(userjsPath,
        'user_pref("javascript.options.shared_memory", false);\n'
        + 'user_pref("marionette.port", 2828);\n'  // should be default
    )

    // Start Firefox headless with the marionette automation enabled
    // (the `&` starts it in the background)
    //
    // !!! If `await` is used here, it will block.  Removing the await seems
    // to work...
    //
    const headless_flag = headless ? '-headless' : null
    exec.exec(
        `firefox ${headless_flag} --profile "${ffprofileDir}" -marionette &`
    )
    await exec.exec('sleep 5')  // Give Firefox time to spin up

    if (verbose) {
        core.info('Running netstat: Marionette should be listening on 2828')
        await exec.exec('netstat -lntu')
        await exec.exec('sh -e -c "ps aux | grep firefox"')
    }

    // Write the script code from the YAML into a temp file that we will pass
    // to the Python helper.
    //
    const tempScriptPath = path.join(_getTempDirectory(), uuidV4())
    core.info(`Writing script to temp file: ${tempScriptPath}`)
    await fsPromises.writeFile(tempScriptPath, script)

    // !!! There's no obvious way to get the directory where the action itself
    // has its files (e.g. finding the action.yml at runtime).  But Node.js
    // offers __dirname for the currently running file.  This code is either
    // running from the %src/ or the %dist/ directory depending on if it is
    // compiled or not, so ../${dirname}/src should give us the path to source
    // to find the Python support script.

    const helperPath = path.join(__dirname, '../src', 'python-web-helper.py')
    core.info(`Running Python Helper Script: ${helperPath}`)

    // Run the script.  The result will be 0 if the test was sucessful.
    //
    let args = [helperPath, tempScriptPath]
    if (commit_short)
        args.push('--shorthash', commit_short)
    if (timeout)
        args.push('--timeout', timeout)
    if (screenshot)
        args.push('--screenshot', screenshot + ".png")

    const options = {
        ignoreReturnCode: true  // give us the non-zero status vs. erroring
    }
    const exitcode = await exec.exec('python3', args, options)

    // If a screenshot was requested, we make life a little bit easier by
    // automatically making that into an artifact.
    //
    if (screenshot) {
        const artifactClient = artifact.create()
        const artifactName = screenshot;
        const files = [
            screenshot + ".png"  // UI will always package as .zip regardless
        ]

        const rootDirectory = '.' // Also possible to use __dirname
        const options = {
            continueOnError: false
        }

        const uploadResponse = await artifactClient.uploadArtifact(
            artifactName,
            files,
            rootDirectory,
            options
        )
    }

    if (verbose)
        await exec.exec('sh -e -c "ps aux | grep firefox"')

    // It doesn't seem firefox always closes, pkill it
    await exec.exec('pkill -9 firefox', [], { ignoreReturnCode: true })

    return exitcode
}

exports.web_invoke = web_invoke
