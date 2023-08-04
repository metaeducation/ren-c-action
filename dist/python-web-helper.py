#
# %python-web-helper.py
# "Marionette" Script for Bridging to Firefox and the Ren-C Web REPL
#
# https://firefox-source-docs.mozilla.org/python/marionette_driver.html
#
# Actual source for driver:
#
# https://hg.mozilla.org/mozilla-central/file/c4d2ca8f78b7680dc0b199a2cb0e2c6f18cd8963/testing/marionette/client/marionette_driver/marionette.py
#
# Note you can change the client context to the "chrome", e.g. read and write
# the URL bar, which is also an HTML element:
#
#     with client.using_context(client.CONTEXT_CHROME):
#         urlbar = client.find_element(By.ID, "urlbar")
#         urlbar.send_keys("about:robots")
#

from __future__ import print_function  # Python3 print(), must be first line
import sys  # For sys.exit() to return result to shell, and commmand-line args


### PYTHON ARGUMENT PARSING ###

# https://docs.python.org/3/howto/argparse.html

import argparse
parser = argparse.ArgumentParser()
parser.add_argument(
    "filename",
    help="filename of script to run in web REPL"
)
parser.add_argument(
    "--timeout",
    help="number of seconds to run script before aborting",
    type=int
)
parser.add_argument(
    "--shorthash",
    help="8-digit short hash of commit of WebAssembly build to use"
)
parser.add_argument(
    "--screenshot",
    help="Filename of screenshot to take of browser on completion"
)
args = parser.parse_args()  # will end script if required arguments not passed


### READ PASSED IN SCRIPT TO VARIABLE ###

with open(args.filename, 'r') as file:
    script = file.read()
print("Python helper received script:", script)

# !!! Unfortunately, keypresses while code is running are not queued but are
# thrown out in the current model of the console.  This means that newlines
# will cause delays and the subsequent keys will be thrown out.  For now
# we hack past it by replacing newlines with spaces, and have only one
# newline to trigger the evaluation.
#
# !!! Note this will mess up `;` to end of line comments!
#
script = script.replace('\n', ' ')


### LOAD MARIONETTE DRIVER AND CONNECT TO ALREADY RUNNING FIREFOX ###

print("Importing 'Marionette' driver to talk to an already-running Firefox")

from marionette_driver import marionette
Marionette = marionette.Marionette
from marionette_driver.by import By

print("Connecting to port 2828...")
print("(Note you must have run Firefox with `-marionette` switch!)")
print("(If you must run on a non-GUI system, be sure to use `-headless` too)")
client = Marionette(host='localhost', port=2828)
client.start_session()

# Timeout will cause a `marionette_driver.errors.ScriptTimeoutException`
#
if args.timeout:
    print("Setting --timeout", args.timeout, "seconds...")
    client.timeout.script = args.timeout
else:
    print("Setting default timeout of 15 seconds")
    client.timeout.script = 15


### START UP REPLPAD WITH REQUESTED COMMIT ###

url = "http://hostilefork.com/media/shared/replpad-js/"

if args.shorthash:
    print("Requesting server lib version:", args.shorthash)
    url = url + "?" + "git_commit=" + args.shorthash
else:
    print("Using default %last-deploy.short-hash on server")

print("Connected!  Navigating to", url)
client.navigate(url)

# We wait for the console to be ready to accept input, which we determine by
# looking for when the `>>` span appears in the document text content.
#
# !!! (should this look for `<span class="input-prompt">` instead?)

try:
    active = client.execute_async_script('''
        console.log('Waiting on >> prompt')
        let [resolve, reject] = arguments;
        let intervalID = setInterval(function() {
            let content = document.documentElement.textContent
            let index = content.indexOf('>>')
            if (index != -1) {
                clearInterval(intervalID)
                resolve(document.activeElement)
            }
        }, 2000);  // check for console input prompt every 2 seconds
    ''')
except marionette.errors.ScriptTimeoutException:
    print("Never found the >> prompt after launching")
    active = None
    found = 0


### INJECT CODE INTO REPLPAD AND WAIT FOR COMPLETION ###

if active:
    # !!! See note in script loading about why newlines are replaced with
    # spaces.  Note that this will mess up comments, and needs to be rethought!
    #
    active.send_keys(script + " " + "print reverse {ETELPMOC TSET}\n")

    print("Looking to see if the PRINT gave the desired output.")

    # !!! With this technique, an error condition will result in not printing out
    # the message so you are subject to the timeout.  It would be better if there
    # were some way of noticing the error state more quickly than the timeout.

    try:
        found = client.execute_async_script('''
            let [resolve, reject] = arguments
            console.log("Checking for Marionette PRINT output to be right...")
            let intervalID = setInterval(function() {
                let content = document.documentElement.textContent
                let index = content.indexOf("TEST COMPLETE")
                if (index != -1) {
                    clearInterval(intervalID)
                    resolve(1)
                }
            }, 2000)  // check every 2 seconds
        ''')
        print("Script was successful.")
    except marionette.errors.ScriptTimeoutException:
        found = 0
        print("It timed out.")


### TAKE SCREENSHOT IF IT WAS REQUESTED ###

# !!! It would be nice if this could automatically give the screenshot as an
# artifact to save people the trouble of packaging it up for downloading.
#
# https://github.com/actions/toolkit/tree/master/packages/artifact

if args.screenshot:
    with open(args.screenshot, "wb") as f:
        client.save_screenshot(f)


### SHUT DOWN MARIONETTE AND FIREFOX ###

# Typical Marionette example scripts end with `client.close()`.  There's some
# problems where Firefox won't quit if you don't have active tabs open, and
# this method seems to be more failsafe.
#
print("Shutting down Firefox")
client._request_in_app_shutdown()

# Note that `client.close()` would fail here if you tried it!

# We want to know from the calling shell if it succeeded or not, so we return
# 0 for yes, 1 for no...(bash true/false)
#
zero_if_success = 0 if found else 1
print("Calling sys.exit(", zero_if_success, ")")
sys.exit(zero_if_success)
