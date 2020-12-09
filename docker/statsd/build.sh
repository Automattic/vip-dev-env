#!/bin/bash

# Please, keep the same version as the original statsd image,
# increasing the suffix if needed
tag=v0.8.6-1

docker build -t wpvipdev/statsd:$tag .
