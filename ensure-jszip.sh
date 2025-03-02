#!/bin/bash

# Download JSZip library
JSZIP_URL="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
wget -O jszip.min.js "$JSZIP_URL"

# Verify download
if [ -f "jszip.min.js" ]; then
    echo "JSZip library downloaded successfully"
    ls -l jszip.min.js
else
    echo "Failed to download JSZip library"
    exit 1
fi