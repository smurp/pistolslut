Engine.include("/engine/engine.math2d.js");
Engine.include("/engine/engine.pooledobject.js");
Engine.include("/resourceloaders/loader.image.js");

Engine.initObject("FurnishedLevelLoader", "LevelLoader", function() {
	var FurnishedLevelLoader = LevelLoader.extend(/** @scope FurnishedLevelLoader.prototype */{
		
		spriteLoader: null,
		
		constructor: function(name, spriteLoader) {
			this.base(name || "FurnishedLevelLoader");
			this.spriteLoader = spriteLoader;
		},

		load: function(name, url, info, path) {
			if (url)
			{
				var loc = window.location;
				if (url.indexOf(loc.protocol) != -1 && url.indexOf(loc.host) == -1) {
					Assert(false, "Levels must be located on this server");
				}

				var thisObj = this;

				// Get the file from the server
				$.get(url, function(data) {
					var levelInfo = EngineSupport.evalJSON(data);

					// get the path to the resource file
					var path = url.substring(0, url.lastIndexOf("/"));
					thisObj.load(name, null, levelInfo, path + "/");
				});
			}
			else
			{
				this.base(name, url, info, path); // let the super do its thing
				
				// now load all the sprites for the furniture
				var levelObjects = info.objects;
				for(var i in levelObjects.furniture)
				{
					var furniturePieceData = levelObjects.furniture[i];					
					this.spriteLoader.load(furniturePieceData.name, null, furniturePieceData.sprite, path);
				}
			}
		},

		get: function(name) {
			var level = this.base(name);
			level.furniture = this.levels[name].furniture;
			level.enemies = this.levels[name].enemies;
			return level;
		},

		getLevel: function(levelName, field, fieldWidth) {
			return FurnishedLevel.create(levelName, field, this.get(levelName), fieldWidth);
		},

		getResourceType: function() {
			return "furnishedLevel";
		}

	}, {
		
		getClassName: function() { return "FurnishedLevelLoader"; }
	});

	return FurnishedLevelLoader;
});

Engine.initObject("FurnishedLevel", "Level", function() {
	
	var FurnishedLevel = Level.extend(/** @scope Level.prototype */{
		
		field: null,
		signs: null,
		furniture: null,
		enemies: null,
		fires: null,
		fireworkLaunchers: null,
		
		snowTimer: null,
		snowFallInterval: 50,
		
		minScroll: 0,
		maxScroll: null,
		levelResource: null,

	  constructor: function(name, field, levelResource, fieldWidth) {
			var level = this.base(name, levelResource);
			this.field = field;
			this.signs = [];
			this.furniture = [];
			this.enemies = [];
			this.fires = [];
			this.fireworkLaunchers = [];
			this.levelResource = levelResource;
			this.maxScroll = this.getWidth() - fieldWidth;
			return level;
		},
		
		liveEnemies: function() {
			var liveEnemies = [];
			for(var i in this.enemies)
				if(this.enemies[i].isAlive())
					liveEnemies.push(this.enemies[i]);

			return liveEnemies;
		},

		addObjects: function(renderContext) {
			this.addFurniture(renderContext);
			this.addEnemies(renderContext);
			this.addSigns(renderContext);
			this.addFires();
			this.addFireworkLaunchers(renderContext);
			this.addSnow();
			this.addDayNightCycle(renderContext);
		},

		// creates Furniture render objects for each piece of furniture loaded from
		// level def file and adds them to the renderContext
		addFurniture: function(renderContext) {
			var data = this.levelResource.info.objects.furniture;
			for(var i in data)
			{
				var furniturePiece = Furniture.create(data[i].name, Point2D.create(data[i].x, data[i].y));
				this.furniture[i] = furniturePiece;
				renderContext.add(furniturePiece);
			}
		},
				
		// creates Enemy render objects for each piece of furniture loaded from
		// level def file and adds them to the renderContext
		addEnemies: function(renderContext) {
			data = this.levelResource.info.objects.enemies;
			for(var i in data)
			{
				var enemy = eval(data[i].clazz).create(data[i].name, Point2D.create(data[i].x, data[i].y), data[i].health);
				this.enemies[i] = enemy;
				renderContext.add(enemy);
			}
		},

		// load signs from the current level
		signLetterSpacing: 7,
		signColor: "#ff0000",
		addSigns: function(renderContext) {
			var data = this.levelResource.info.objects.signs;
			for(var i in data)
			{
				this.signs[i] = new Sign(this.field, data[i].text, this.signColor, Point2D.create(data[i].x, data[i].y), data[i].width, this.signLetterSpacing);
				renderContext.add(this.signs[i]);
				this.field.notifier.subscribe(Human.CLIP_EMPTY, this.signs[i], this.signs[i].notifyWeaponEmpty);
				this.field.notifier.subscribe(Human.RELOADED, this.signs[i], this.signs[i].notifyReloaded);
				this.field.notifier.subscribe(Weapon.SWITCH, this.signs[i], this.signs[i].notifyWeaponSwitch);
			}
		},
		
		addFires: function() {
			var data = this.levelResource.info.objects.fires;
			for(var i in data)
				this.fires[i] = new Fire(data[i].name, this.field, data[i].x, data[i].y, data[i].width);	
		},
		
		addFireworkLaunchers: function(renderContext) {
			var data = this.levelResource.info.objects.fireworkLaunchers;
			for(var i in data)
				this.fireworkLaunchers[i] = new FireworkLauncher(data[i].name, this.field, renderContext, data[i].x, data[i].y, data[i].angle, data[i].spread, data[i].interval);
		},
		
		addSnow: function() {
			var level = this;
			this.snowTimer = Interval.create("snow", this.snowFallInterval,
				function() {
					level.field.pEngine.addParticle(SnowParticle.create(level.getWidth()));
			});
		},
		
		skyColor: [
			{ start: 70,  end: 255, parts: [2],   },
			{ start: 17,  end: 180, parts: [0,1], },
			{ start: 180, end: 17,  parts: [0,1], },
			{ start: 255, end: 70,  parts: [2],   },
		],
		
		// makes sky lighten and darken
		stage: 0,
		hue: 0,
		hueStep: 1,
		dayNightCycleInterval: 500,
		currentColor: ["00", "00", "46"],
		addDayNightCycle: function(renderContext) {
			this.hue = this.skyColor[this.stage].start; // get starting hue of starting stage
			var level = this;
			this.dayNightCycleTimer = Interval.create("dayNightCycle", this.dayNightCycleInterval,
				function() {
					level.updateSkyColor();
					renderContext.setBackgroundColor(level.getSkyColor());
			});
		},
		
		updateSkyColor: function() {
			if(this.hue == this.skyColor[this.stage].end) // maybe move to next stage
			{
				if(this.stage == this.skyColor.length - 1)
					this.stage = 0;
				else
					this.stage += 1;
					
				this.hue = this.skyColor[this.stage].start;
			}
			else
			{
				for(var i = 0; i < 3; i++)
					if(this.skyColor[this.stage].parts.indexOf(i) > -1) // this part of hex is changing
						this.currentColor[i] = this.hue.toString(16);
					else // this part of hex is staying the same
						this.currentColor[i] = this.currentColor[i];
						
				if(this.skyColor[this.stage].start < this.skyColor[this.stage].end)
					this.hue += this.hueStep;
				else
					this.hue -= this.hueStep;
			}
		},
		
		getSkyColor: function() {
			console.log(this.currentColor[0], this.currentColor[1], this.currentColor[2], this.hue)
			return "#" + this.currentColor[0] + this.currentColor[1] + this.currentColor[2];
		},

		// returns world coordinates of view frame
		getViewFrame: function(renderContext) {
			return Rectangle2D.create(renderContext.getHorizontalScroll(), renderContext.getVerticalScroll(), this.field.fieldWidth, this.field.fieldHeight);
		},

		release: function() {
			this.base();
			this.field = null;
			this.signs = null;
			this.furniture = null;
			this.enemies = null;
			this.fires = null;
			this.fireworkLaunchers = null;
			this.minScroll = 0;
			this.maxScroll = null;
			this.levelResource = null;
		},
	}, {

		getClassName: function() { return "FurnishedLevel"; }
	});

	return FurnishedLevel;
});