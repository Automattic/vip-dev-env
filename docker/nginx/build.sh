#!/bin/bash

# Please, keep the same version as the original nginx image,
# increasing the suffix if needed
tag=1.19.2-2

docker build -t wpvipdev/nginx:$tag .
