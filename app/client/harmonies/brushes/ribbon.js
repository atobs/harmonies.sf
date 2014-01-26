function ribbon( context )
{
	this.init( context );
}

ribbon.prototype =
{
	context: null,

	mouseX: null, mouseY: null,

	painters: null,

	interval: null,

	init: function( context )
	{
		var scope = this;
	
                console.log("CONTEXT IS", context);
		this.context = context;
		this.context.globalCompositeOperation = 'source-over';

		this.mouseX = SCREEN_WIDTH / 2;
		this.mouseY = SCREEN_HEIGHT / 2;

		this.painters = new Array();
		
		for (var i = 0; i < 50; i++)
		{
			this.painters.push({ dx: SCREEN_WIDTH / 2, dy: SCREEN_HEIGHT / 2, ax: 0, ay: 0, div: 0.1, ease: Math.random() * 0.2 + 0.6 });
		}
		
		this.interval = setInterval( update, 1000/60 );
		
		function update()
		{
			var i;
			
			window.CONTEXT.lineWidth = BRUSH_SIZE;			
			window.CONTEXT.strokeStyle = "rgba(" + COLOR[0] + ", " + COLOR[1] + ", " + COLOR[2] + ", " + 0.05 * BRUSH_PRESSURE + ")";
			
			for (i = 0; i < scope.painters.length; i++)
			{
				window.CONTEXT.beginPath();
				window.CONTEXT.moveTo(scope.painters[i].dx, scope.painters[i].dy);		

				scope.painters[i].dx -= scope.painters[i].ax = (scope.painters[i].ax + (scope.painters[i].dx - scope.mouseX) * scope.painters[i].div) * scope.painters[i].ease;
				scope.painters[i].dy -= scope.painters[i].ay = (scope.painters[i].ay + (scope.painters[i].dy - scope.mouseY) * scope.painters[i].div) * scope.painters[i].ease;
				window.CONTEXT.lineTo(scope.painters[i].dx, scope.painters[i].dy);
				window.CONTEXT.stroke();
			}
		}
	},
	
	destroy: function()
	{
		clearInterval(this.interval);
	},

	strokeStart: function( mouseX, mouseY )
	{
		this.mouseX = mouseX;
		this.mouseY = mouseY

		for (var i = 0; i < this.painters.length; i++)
		{
			this.painters[i].dx = mouseX;
			this.painters[i].dy = mouseY;
		}

		this.shouldDraw = true;
	},

	stroke: function( mouseX, mouseY )
	{
		this.mouseX = mouseX;
		this.mouseY = mouseY;
	},

	strokeEnd: function()
	{
	
	}
}
module.exports = ribbon
