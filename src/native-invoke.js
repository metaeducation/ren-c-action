//
// src/native-invoke.js
//
//=//// NOTICE ////////////////////////////////////////////////////////////=//
//
// Editing this file and committing it--either in the master repository or in
// your own clone--is insufficient to run it in the could as a GitHub Action.
// It must be compiled and run from the %dist/ directory.  See BUILDING.md
//
//=////////////////////////////////////////////////////////////////////////=//
//
// Besides installing (and caching the interpreter for all steps in a job),
// this GitHub Action can also run script code.
//
// Today this facility is modest (just writes to a temporary file and then
// runs that file).  However, it might be extended to let you pick from a
// premade (or linked) configuration so that the script code is contextualized
// into a dialect for specialized processing of a DSL.
//


// Used for logging via `core.info` (as opposed to console.log)
// https://github.com/actions/toolkit/tree/main/packages/core
const core = require('@actions/core')

// Needed to invoke `chmod +x` on Linux/Mac to make the downloaded r3 runnable
// https://github.com/actions/toolkit/tree/main/packages/exec
const exec = require('@actions/exec')

// https://github.com/actions/toolkit/tree/main/packages/tool-cache
const tc = require('@actions/tool-cache')

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

async function native_invoke(exePath, script)
{
    // Trying to pass the script on the command line creates escaping problems.
    // We write the script to a temporary file.

    const tempScriptPath = path.join(_getTempDirectory(), uuidV4())
    core.info(`Writing script to temp file: ${tempScriptPath}`)
    await fsPromises.writeFile(tempScriptPath, script)

    const exitcode = exec.exec(exePath, [tempScriptPath])
    return exitcode
}

exports.native_invoke = native_invoke
