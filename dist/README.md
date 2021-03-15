# `dist/` Directory: Compiled Sources Runnable Without `node_modules`

This directory should be empty on the `main` branch.

On the `release` branch it contains the compiled forms of the code in `src/`.
Necessary code from the `node_modules` directory that the developer installs
locally is extracted and glommed into the files with the `ncc` command:

    ncc build src/index.js --license licenses.txt
