//
// src/cache.js
//
//=//// NOTICE ////////////////////////////////////////////////////////////=//
//
// Editing this file and committing it--either in the master repository or in
// your own clone--is insufficient to run it in the could as a GitHub Action.
// It must be compiled and run from the %dist/ directory.  See BUILDING.md
//
//=////////////////////////////////////////////////////////////////////////=//
//
// GitHub Actions has the `tool-cache` Node.js library for caching downloaded
// tools across a workflow:
//
// https://github.com/actions/toolkit/tree/main/packages/tool-cache
//
// So we leverage that here.  It's not too magical; it basically uses the
// RUNNER_TEMP and RUNNER_TOOL_CACHE environment variables as places to put
// things.  More or less just the /tmp directory.
//
// (Some functions will also use the GITHUB_WORKSPACE directory or the
// process's current working directory.  But it seems best to avoid writing
// there if possible.)
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

// For parity with how downloadTool etc. work, use GitHub's http request lib
// https://github.com/actions/http-client
const httpm = require('@actions/http-client')


// Note: No longer built by travis, we should change the name...
//
const CDN = 'https://metaeducation.s3.amazonaws.com/travis-builds'


async function get_cached_else_download(checked)
{
    const platform = os.platform()

    let extension = ''
    if (platform == 'win32')
        extension = '.exe'  // needed on windows

    const exeName = 'r3' + extension

    const cacheKey = 'ren-c'
    const version = '3.0.0'  // see notes; must be "explicit" when cached

    // Even if you cache the full path including filename with `tc.cacheFile()`
    // the return result of `tc.find()` is just the containing directory.  So
    // you need to know the name of the file, e.g. `exeName`.
    //
    const cachedDir = tc.find(cacheKey, version, 'x64');
    if (cachedDir) {
        //
        // Note: We don't have to add to env.PATH (that was done at cache time)
        //
        // !!! Should we double check here that the file actually exists?
        //
        const cachedPath = path.join(cachedDir, exeName)
        core.info(`Cached r3 Executable Found: ${cachedPath}`)
        return cachedPath
    }

    // These are the OS_IDs following the historical numbering convention.
    // All of the containers on GitHub Actions are 64-bit, meaning x.x.40
    //
    // https://github.com/metaeducation/ren-c/blob/master/tools/systems.r
    //
    let OS_ID
    switch (platform) {
      case 'linux':
        OS_ID = '0.4.40'
        break

      case 'win32':
        OS_ID = '0.3.40'
        break

      case 'darwin':
        OS_ID = '0.2.40'
        break

      default:
        throw new Error(`Unexpected platform '${platform}'`)
    }

    // The downloadTool function is not written atop something like the `fetch`
    // API implemented for Node, but instead uses a GitHub Actions http-client:
    //
    // https://github.com/actions/http-client
    //
    // It's not clear what particular proxying issues this is designed to be
    // working around, exactly...but for consistency, we use it here.  Fetch
    // would be nicer.  :-/
    //
    _http = new httpm.HttpClient('http-ren-c-action')
    core.info(`Finding out hash of most recent binary for ${OS_ID}`)
    let res = await _http.get(`${CDN}/${OS_ID}/last-deploy.short-hash`)
    let shorthash = await res.readBody()
    core.info(`Last greenlit hash was ${shorthash}`)

    // downloadTool puts the file in the RUNNER_TEMP directory and gives a name
    // along the lines of `/tmp/73cac479-bfd0-42d7-a157-daef3602e987`.
    //
    // !!! Using a temporary file as proof of concept...needs to be coming from
    // our Amazon S3 instance as latest build.  Logic for that is more complex.
    //
    let suffix = ''
    if (checked)
      suffix = '-debug'
    let exeUrl = `${CDN}/${OS_ID}/r3-${shorthash}${suffix}${extension}`

    core.info(`Attempting to Download ${exeUrl}`)
    const downloadPath = await tc.downloadTool(exeUrl)
    core.info(`r3 Transient Downloaded To ${downloadPath}`)

    // Use chmod +x to set the executable bit.  We do this on the download
    // rather than after the cache, in case there were some more restrictive
    // privileges on the cache directory once moved.  (Though there isn't,
    // at time of writing.)
    //
    if (platform == 'linux' || platform == 'darwin') {
        core.info(`Setting Executable Bit via chmod`)
        await exec.exec('chmod', ['+x', downloadPath]);
    }

    // If you don't provide an "explicit version" (e.g. three digits X.Y.Z)
    // when you make the cache, the query doesn't seem to work.  This caching
    // mechanism is built on "semver" and that seems to be the rule:
    //
    // https://semver.org/
    //
    // A more vague spec can be used in `tc.find()`, e.g. "3.x"...just not
    // in tc.cacheFile()
    //
    core.info(`Using GitHub tool-cache Facility to Persist Across Steps`)
    const exeDir = await tc.cacheFile(
        downloadPath,
        exeName,
        cacheKey,
        version
    )
    const exePath = path.join(exeDir, exeName)
    core.info(`Caching as ${exePath}`)

    // We add the directory to the path for the job the first time, but not
    // on successive caches.
    //
    // https://github.com/actions/toolkit/tree/main/packages/core#path-manipulation
    //
    // !!! Make this optional?
    //
    core.info(`Adding ${exeDir} to the env.PATH for Searched Executables`)
    core.addPath(exeDir);

    return exePath
}

exports.get_cached_else_download = get_cached_else_download
