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

print("== Python Test of Web Repl Starting ==")
print("Importing 'Marionette' driver for talking to an already-running Firefox")

from marionette_driver import marionette
Marionette = marionette.Marionette
from marionette_driver.by import By

# Currently the only option the test script takes is which commit of Rebol
# you want the REPL to fetch (so that non-deployed versions can be tested
# before being "green-lit"
#
shorthash = None
if (len(sys.argv) < 2):
    raise Exception("Require at least script filename to run as argument")

with open(sys.argv[1], 'r') as file:
    script = file.read()
print("Python helper received script:", script)

if (len(sys.argv) == 2):
    print("Using default %last-deploy.short-hash on server")
elif (len(sys.argv) == 4 and sys.argv[2] == "--shorthash"):
    shorthash = sys.argv[3]
    print("Requesting server lib version:", shorthash)
else:
    raise Exception("Must run with no args or `--shorthash <hash>`")

print("Connecting to port 2828...")
print("(Note you must have run Firefox with `-marionette` switch!)")
print("(If you must run on a non-GUI system, be sure to use `-headless` too)")
client = Marionette(host='localhost', port=2828)
client.start_session()

url = "http://hostilefork.com/media/shared/replpad-js/"
if (shorthash):
    url = url + "?" + "git_commit=" + shorthash

print("Connected!  Navigating to", url)
client.navigate(url)

print("Injecting some Rebol code, we'll give it 10 seconds...")
client.timeout.script = 15
active = client.execute_async_script('''
    console.log("Giving web console 10 seconds to load up")
    let [resolve, reject] = arguments;
    setTimeout(function() {
        resolve(document.activeElement);
    }, 10000);  // waits 10 seconds
''')

# !!! Unfortunately, keypresses while code is running are not queued but are
# thrown out in the current model of the console.  This means that newlines
# will cause delays and the subsequent keys will be thrown out.  For now
# we hack past it by replacing newlines with spaces, and have only one
# newline to trigger the evaluation.
#
script = script.replace('\n', ' ')
active.send_keys(script + " " + "print reverse {ETELPMOC TSET}\n")


print("Looking to see if the PRINT gave the desired output.")
found = client.execute_async_script('''
    let [resolve, reject] = arguments
    console.log("Checking for Marionette PRINT output to be right...")
    setTimeout(function() {
        let content = document.documentElement.textContent
        let index = content.indexOf("TEST COMPLETE")
        resolve(index != -1)
    }, 10000)  // waits 10 seconds
''')
print("Came back with result:", found)

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
