## Dev environment with containers

> ==============================
>
> THIS REPO IS BEING DEPRECATED.
>
> Please go to https://github.com/Automattic/vip-container-images
>
> ==============================

This is a PoC of a new model for the dev environment based almost completely on containers.

It also integrates the ideas of multi-instance support from https://github.com/Automattic/vip-go-mu-dev/pull/32

### Creating an instance

After installing dependencies with `npm install`, you can create a new instance with:

```
./vipdev.js create <slug>
```

This will create the directory `site-<slug>` where the final `.lando.yml` file will be located.

You can set several parameters to tune the instance, e.g:

```
./vipdev.js create testing \
  --title "Site Title" \
  --php 7.3 \
  --wordpress 5.5.1 \
  --mu-plugins /home/code/vip-go-mu-plugins \
  --client-code /home/code/vip-wordpress-com
```

As you can see, you can choose to use your local clone of `mu-plugins` in case you want to develop on it (by default it will use a container that auto updates the repo). You can also choose the local path to the client code (by default it will use the `vip-go-skeleton` container).

You can also fetch all required data using the site id:

```
./vipdev.js create wpvip --site 1513
```

This will obtain the PHP and WordPress version from GOOP, and it will clone the git repo with the client code, putting it in `site-wpvip/clientcode`


### Upgrading an instance

After an instance has been created, you can upgrade some of its components. E.g:

```
./vipdev.js upgrade testing \
  --php 7.4 \
  --wordpress 5.5.1 \
  --mu-plugins auto
```

This will rebuild the app containers but without losing any data.


## Common use cases

NOTE: Default `wp-admin` credentials are `vipgo:password`

### MU-plugins DEV

When you want to have basic site that is using your local mu-plugins code checkout similar to what previous `vip-go-mu-dev` environment used to do:

```
./vipdev.js create <env-name> --mu-plugins <mu-plugins-absolute-path>
```

### MU-plugins DEV multisite (-m)

```
./vipdev.js create <env-name> -m --mu-plugins <mu-plugins-absolute-path>
```

To add sites:

```
cd dev-<env-name>
lando add-site --slug=test --title="Test"
```

### To-Do

There are a few things that are needed before matching the functionalities of the current lando environment in `mu-dev`:

- Multisite support [DONE]
- Cron control
- Mu-plugins tests


### Container definitions

In the directory `docker` you can find the Dockerfiles for all containers used in this environment. They are pushed to the organization `wpvipdev` in dockerhub (all of them are based on open source projects, so they can be public).

If you need to change anything on the docker images:
1. Adapt the `Dockerfile` and/or the scripts or config files
1. Bump the tag version in the corresponding `build.sh` script
1. Run `sh build.sh`, it will build the new docker image locally
1. Bump the required version in `.lando.yml.ejs` (but don't commit yet)
1. Test it in your local dev environment
1. Once you are happy with it, you can push the image to dockerhub using the script `tools/push-public.sh` in the [vip-docker repo](https://github.com/Automattic/vip-docker/), so it can be made available to any other user
1. Commit/Push/PR your changes to `.lando.yml.ejs` so the new docker images requirements are distributed
