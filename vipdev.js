#!/usr/bin/env node

const program = require( 'commander' );
const fs = require( 'fs' );
const ejs = require( 'ejs' );
const cp = require( 'child_process' );

const defaultPHP = '7.3';

const containerImages = {
	'wordpress': {
		image: 'wpvipdev/wordpress',
		tag: '5.6',
	},
	'jetpack': {
		image: 'wpvipdev/jetpack',
	},
	'muplugins': {
		image: 'wpvipdev/mu-plugins',
		tag: 'auto',
	},
	'skeleton': {
		image: 'wpvipdev/skeleton',
		tag: '181a17d9aedf7da73730d65ccef3d8dbf172a5c5',
	}
}

program
	.command( 'create <slug>' )
	.description( 'Create a new local development instance' )
	.arguments( 'slug', 'Short name to be used for the lando project and the internal domain' )
	.option( '-t, --title <title>', 'Title for the WordPress site (default: "VIP Dev")' )
	.option( '-m, --multisite', 'Enable multisite install' )
	.option( '-s, --site <site_id>', 'Get all options below for a specific site' )
	.option( '-p, --php <php-version>', 'Use a specific PHP version (default: ' + defaultPHP + ')' )
	.option( '-w, --wordpress <wordpress>', 'Use a specific WordPress version or local directory (default: last stable)' )
	.option( '-u, --mu-plugins <mu-plugins>', 'Use a specific mu-plugins changeset or local directory (default: "auto": last commit in master)' )
	.option( '-j, --jetpack <jetpack>', 'Use a specific Jetpack from a local directory (default: "mu": use the version in mu-plugins)' )
	.option( '-c, --client-code <clientcode>', 'Use the client code from github or a local directory (default: use the VIP skeleton)' )
	.option( '--no-start', 'If provided, don\'t start the Lando environment, just create it' )
	.action( createAction );

program
	.command( 'upgrade <slug>' )
	.description( 'Upgrade versions for one or more components of a development instance' )
	.arguments( 'slug', 'Name of the development instance' )
	.option( '-p, --php <php-version>', 'Use a specific PHP version (default: ' + defaultPHP + ')' )
	.option( '-w, --wordpress <wordpress>', 'Use a specific WordPress version or local directory' )
	.option( '-u, --mu-plugins <mu-plugins>', 'Use a specific mu-plugins changeset or local directory ("auto" for auto updates)' )
	.option( '-j, --jetpack <jetpack>', 'Use a specific Jetpack from a local directory ("mu" for the version in mu-plugins)' )
	.option( '-c, --client-code <clientcode>', 'Use the client code from github or a local directory' )
	.action( upgradeAction );

program.parse( process.argv );

async function createAction( slug, options ) {
	const instancePath = 'dev-' + slug;
	if ( fs.existsSync( instancePath ) ) {
		return console.error( 'Instance ' + slug + ' already exists' );
	}
	fs.mkdirSync( instancePath );

	// Fill options if a site is provided
	// TODO: Detect incompatible options
	if ( options.site ) {
		setOptionsForSiteId( options, options.site );
	}

	let instanceData = {
		siteSlug: slug,
		wpTitle: options.title || 'VIP Dev',
		multisite: options.multisite || false,
		wordpress: {},
		muplugins: {},
		jetpack: {},
		clientcode: {},
	};

	updateSiteDataWithOptions( instanceData, options );

	await prepareLandoEnv( instanceData, instancePath );

	console.log( instanceData );
	fs.writeFileSync( instancePath + '/instanceData.json', JSON.stringify( instanceData ) );

	if ( options.start ) {
		landoStart( instancePath );
		console.log( 'Lando environment created on directory "' + instancePath + '" and started.' );
	} else {
		console.log( 'Lando environment created on directory "' + instancePath + '".' );
		console.log( 'You can cd into that directory and run "lando start"' );
	}
}

async function upgradeAction( slug, options ) {
	const instancePath = 'dev-' + slug;
	const instanceData = JSON.parse( fs.readFileSync( instancePath + '/instanceData.json' ) );

	updateSiteDataWithOptions( instanceData, options );

	fs.writeFileSync( instancePath + '/instanceData.json', JSON.stringify( instanceData ) );

	await prepareLandoEnv( instanceData, instancePath );

	landoRebuild( instancePath );
}

function setOptionsForSiteId( options, siteId ) {
    let response = cp.execSync( 'vipgo api GET /sites/' + siteId ).toString();
	const siteInfo = JSON.parse( response );

	options.title = siteInfo.data[0].name + ' (' + siteId + ')';

	const repo = siteInfo.data[0].source_repo;
	const branch = siteInfo.data[0].source_repo_branch;
	options.clientCode = 'git@github.com:' + repo + '#' + branch

	options.multisite = siteInfo.data[0].is_multisite;

    response = cp.execSync( 'vipgo api GET /sites/' + siteId + '/allocations' ).toString();
	const siteAllocations = JSON.parse( response );

	siteAllocations.data.forEach( ( allocation ) => {
		if ( allocation.container_type_id == 1 ) {
			options.wp = allocation.software_stack_name.split( ' ' ).slice( -1 )[0];
			options.php = allocation.container_image_name.split( ' ' ).slice( -1 )[0];
		}
	} );
}

function updateSiteDataWithOptions( instanceData, options ) {
	updatePhpData( instanceData, options.php );
	updateWordPressData( instanceData, options.wordpress );
	updateMuPluginsData( instanceData, options.muPlugins );
	updateJetpackData( instanceData, options.jetpack );
	updateClientCodeData( instanceData, options.clientCode );
}

function updatePhpData( instanceData, phpParam ) {
	if ( phpParam ) {
		instanceData.phpVersion = phpParam;
	} else if ( ! instanceData.phpVersion ) {
		instanceData.phpVersion = defaultPHP;
	}
}

function updateWordPressData( instanceData, wpParam ) {
	if ( wpParam ) {
		if ( wpParam.includes( '/' ) ) {
			instanceData.wordpress = {
				mode: 'local',
				dir: wpParam,
			}
		} else {
			instanceData.wordpress = {
				mode: 'image',
				image: containerImages['wordpress'].image,
				tag: wpParam,
			}
		}
	} else if ( ! instanceData.wordpress.mode ) {
		instanceData.wordpress = {
			mode: 'image',
			image: containerImages['wordpress'].image,
			tag: containerImages['wordpress'].tag,
		}
	}
}

function updateMuPluginsData( instanceData, muParam ) {
	if ( muParam ) {
		if ( muParam.includes( '/' ) ) {
			instanceData.muplugins = {
				mode: 'local',
				dir: muParam,
			}
		} else {
			instanceData.muplugins = {
				mode: 'image',
				image: containerImages['muplugins'].image,
				tag: muParam,
			}
		}
	} else if ( ! instanceData.muplugins.mode ) {
		instanceData.muplugins = {
			mode: 'image',
			image: containerImages['muplugins'].image,
			tag: containerImages['muplugins'].tag,
		}
	}
}

function updateJetpackData( instanceData, jpParam ) {
	if ( jpParam ) {
		if ( jpParam.includes( '/' ) ) {
			instanceData.jetpack = {
				mode: 'local',
				dir: jpParam,
			}
		} else if ( jpParam === 'mu' ) {
			instanceData.jetpack = {
				mode: 'inherit',
			}
		} else {
			instanceData.jetpack = {
				mode: 'image',
				image: containerImages['jetpack'].image,
				tag: jpParam,
			}
		}
	} else if ( ! instanceData.jetpack.mode ) {
		instanceData.jetpack = {
			mode: 'inherit',
		}
	}
}

function updateClientCodeData( instanceData, codeParam ) {
	if ( codeParam ) {
		if ( codeParam.includes( 'github' ) ) {
			instanceData.clientcode = {
				mode: 'git',
				repo: codeParam,
				fetched: false,
			}
		} else {
			instanceData.clientcode = {
				mode: 'local',
				dir: codeParam,
			}
		}
	} else if ( ! instanceData.clientcode.mode ) {
		instanceData.clientcode = {
			mode: 'image',
			image: containerImages['skeleton'].image,
			tag: containerImages['skeleton'].tag,
		}
	}
}

async function prepareLandoEnv( instanceData, instancePath ) {
	if ( instanceData.clientcode.mode == 'git' && ! instanceData.clientcode.fetched ) {
		const clonePath = instancePath + '/clientcode';

		try {
			fs.rmdirSync(clonePath, { recursive: true })
		} catch (err) {
			const {
				code = ''
			} = err;

			// rmdir throws an error if the directory does not exist.
			// it's not worth wasting a call to fileExists beforehand since the goal is to delete the directory.
			if ( -1 === ['ENOENT', 'ENOTDIR'].indexOf(code) ) {
				// something else happened, throw the error.
				throw err;
			}
		}

		console.log( 'Cloning client code repo: ' + instanceData.clientcode.repo );

		let [ repo, branch ] = instanceData.clientcode.repo.split( '#' );

		let cmd = 'git clone --recurse-submodules ' + repo + ' ' + clonePath;
		if ( branch ) {
			cmd += ' --branch ' + branch;
		}

		cp.execSync( cmd );
		instanceData.clientcode.fetched = true;
		instanceData.clientcode.dir = './clientcode';
	}
	const landoFile = await ejs.renderFile( '.lando.yml.ejs', instanceData );
	fs.writeFileSync( instancePath + '/.lando.yml', landoFile );
}

function landoStart( instancePath ) {
	cp.execSync( 'lando start', { cwd: instancePath, stdio: 'inherit' } );
}

function landoRebuild( instancePath ) {
	cp.execSync( 'lando rebuild -y', { cwd: instancePath, stdio: 'inherit' } );
}
