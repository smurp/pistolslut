Engine.include("/components/component.mover2d.js");
Engine.include("/components/component.vector2d.js");
Engine.include("/engine/engine.object2d.js");

Engine.initObject("Collider", "Base", function() {
	var Collider = Base.extend({
	
		field: null,
	
		constructor: function(field) {
			this.field = field;
		},
	
		inLineOfFire: function(shooter, target, inSafetyMargin) {
			var inLine = false;
			
			var safetyMargin = 0;
			if(inSafetyMargin != null)
				safetyMargin = inSafetyMargin;
			
			var muzzlePosition = shooter.weapon.getGunTip();
			var targetRect = new CheapRect(target);
			
			if(muzzlePosition.y <= targetRect.b + safetyMargin && muzzlePosition.y >= targetRect.y - safetyMargin) // intersecting on y-axis
			{
				if(shooter.direction == Collider.LEFT)
					inLine = targetRect.x < muzzlePosition.x;
				else if(shooter.direction == Collider.RIGHT)
					inLine = muzzlePosition.x < targetRect.r;
			}

			return inLine;
		},
	
		aFallingThroughB: function(a, b) {
			var aRect = new CheapRect(a);
			var bRect = new CheapRect(b);
			return a.getVelocity().y >= 0 && aRect.b > bRect.y && aRect.b < bRect.y + 14;
		},
	
		aOnB: function(a, b) {
			var aRect = new CheapRect(a);
			var bRect = new CheapRect(b);
			return aRect.b == bRect.y;
		},
	
		aOnLeftAndBumpingB: function(a, b) {
			var aRect = new CheapRect(a);
			var bRect = new CheapRect(b);
			return aRect.r >= bRect.x && aRect.x < bRect.x && !this.aOnB(a, b);
		},
	
		aOnRightAndBumpingB: function(a, b) {
			var aRect = new CheapRect(a);
			var bRect = new CheapRect(b);
			return aRect.x <= bRect.r && aRect.r > bRect.r && !this.aOnB(a, b);
		},
		
		aOnBottomAndBumpingB: function(a, b) {
			var aRect = new CheapRect(a);
			var bRect = new CheapRect(b);
			return a.getVelocity().y <= 0 && aRect.y < bRect.b && aRect.y > bRect.b - 14;
		},
	
		getPCL: function(subject) {
			return this.field.collisionModel.getPCL(subject.getPosition());
		},
	
		// returns true if subject colliding with any of the objects
		// if clazz supplied, only checks objects of that type
		colliding: function(subject, objects, clazz) {
			for(var i in objects)
				if(clazz == null || objects[i] instanceof clazz)
					if(new CheapRect(subject).isIntersecting(new CheapRect(objects[i])))
						return true;
			return false;
		},
		
		objsColliding: function(obj1, obj2) {
			return this.getRect(obj1).isIntersecting(this.getRect(obj2));
		},
		
		getRect: function(obj) {
			if(obj instanceof Furniture)
				return obj.rect;
			else
				return new CheapRect(obj);
		},
		
		objectAtLeastDistanceAway: function(obj1, obj2, distance) {
			if(obj1.getPosition().dist(obj2.getPosition()) >= distance)
				return true;
			else
				return false;
		},
		
		moveToEdge: function(obj, collisionPoint, sideHit) {
			console.log(obj, collisionPoint.x, collisionPoint.y, sideHit);
			if(sideHit == Collider.TOP)
				obj.getPosition().setY(collisionPoint.y - obj.getBoundingBox().dims.y);
			else if(sideHit == Collider.BOTTOM)
				obj.getPosition().setY(collisionPoint.y);
			else if(sideHit == Collider.LEFT)
				obj.getPosition().setX(collisionPoint.x - obj.getBoundingBox().dims.x);
			else if(sideHit == Collider.RIGHT)
				obj.getPosition().setX(collisionPoint.x);
		},
	
		// returns point that moving obj hit staticObj
		pointOfImpact: function(movingObj, staticObj) {
			var mOCurPos = movingObj.getPosition();
			var mOPrevPos = movingObj.getLastPosition();
			var mODims = movingObj.getBoundingBox().dims;
			var sOPos = staticObj.getPosition();
			var sODims = staticObj.getBoundingBox().dims;
							
			// staticobj on bottom
			var p1 = Point2D.create(mOPrevPos.x,mOPrevPos.y + mODims.y);
			var p2 = Point2D.create(mOCurPos.x,mOCurPos.y + mODims.y);
			var p3 = Point2D.create(sOPos.x,sOPos.y);
			var p4 = Point2D.create(sOPos.x + sODims.x,sOPos.y);
			if(Math2D.lineLineCollision(p1, p2, p3, p4))
				return [Math2D.lineLineCollisionPoint(p1, p2, p3, p4), Collider.TOP];
		
			// staticobj on right
			var p1 = Point2D.create(mOPrevPos.x + mODims.x,mOPrevPos.y + mODims.y);
			var p2 = Point2D.create(mOCurPos.x + mODims.x,mOCurPos.y + mODims.y);
			var p3 = Point2D.create(sOPos.x,sOPos.y);
			var p4 = Point2D.create(sOPos.x,sOPos.y + sODims.y);
			if(Math2D.lineLineCollision(p1, p2, p3, p4))
				return [Math2D.lineLineCollisionPoint(p1, p2, p3, p4), Collider.LEFT];
		
			// staticobj on left
			var p1 = Point2D.create(mOPrevPos.x,mOPrevPos.y);
			var p2 = Point2D.create(mOCurPos.x,mOCurPos.y);
			var p3 = Point2D.create(sOPos.x + sODims.x,sOPos.y);
			var p4 = Point2D.create(sOPos.x + sODims.x,sOPos.y + sODims.y);
			if(Math2D.lineLineCollision(p1, p2, p3, p4))
				return [Math2D.lineLineCollisionPoint(p1, p2, p3, p4), Collider.RIGHT];
		
			// staticobj on top
			var p1 = Point2D.create(mOPrevPos.x,mOPrevPos.y);
			var p2 = Point2D.create(mOCurPos.x,mOCurPos.y);
			var p3 = Point2D.create(sOPos.x,sOPos.y + sODims.y);
			var p4 = Point2D.create(sOPos.x + sODims.x,sOPos.y + sODims.y);
			if(Math2D.lineLineCollision(p1, p2, p3, p4))
				return [Math2D.lineLineCollisionPoint(p1, p2, p3, p4), Collider.BOTTOM];
			
			return null; // no intersection
		},
		
	}, {

		getClassName: function() { return "Collider"; },
		
		LEFT: "Left",
		RIGHT: "Right",
		TOP: "Top",
		BOTTOM: "Bottom",
	});

	return Collider;
});