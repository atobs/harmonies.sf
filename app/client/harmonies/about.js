function About() {
    this.init();
}

About.prototype = {
    container: null,

    init: function() {
        var text, containerText;

        this.container = document.createElement("div");
        this.container.className = 'gui';
        this.container.style.position = 'absolute';
        this.container.style.top = '0px';
        this.container.style.visibility = 'hidden';

        containerText = document.createElement("div");
        containerText.style.margin = '10px 10px';
        containerText.style.textAlign = 'left';
        this.container.appendChild(containerText);

        text = document.createElement("p");
        text.style.textAlign = 'center';
        text.innerHTML = '<strong>HARMONY </strong>' + 'by <a href="http://www.twitter.com/mrdoob" target="_blank">Mr.doob</a>';
        containerText.appendChild(text);

        text = document.createElement("p");
        text.style.textAlign = 'center';
        text.innerHTML = 'Zoom: <span class="key">-</span> <span class="key">+</span> Pan: <span class="key">p</span><br />Brush: <span class="key">d</span><span class="key">f</span> size, <span class="key">r</span> reset<br />Color: <span class="key">c</span> wheel, <span class="key">Shift</span> picker<br />';
        containerText.appendChild(text);

        text = document.createElement("p");
        text.style.textAlign = 'center';
        text.innerHTML = '<a href="http://mrdoob.com/blog/post/689" target="_blank">Info</a> - <a href="http://github.com/juniferd/harmonies" target="_blank">Source Code</a>';
        containerText.appendChild(text);

        text = document.createElement("hr");
        containerText.appendChild(text);

        text = document.createElement("p");
        text.innerHTML = '<em>Sketchy</em>, <em>Shaded</em>, <em>Chrome</em>, <em>Fur</em>, <em>LongFur</em> and <em>Web</em> are all variations of the <a href="http://www.zefrank.com/scribbler/" target="_blank">neighbour points connection concept.</a>.';
        containerText.appendChild(text);

        text = document.createElement("hr");
        containerText.appendChild(text);
        text = document.createElement("p");
        text.style.textAlign = 'center';
        text.innerHTML = 'Integrated with Node + Socket.IO for multiplayer support';

        containerText.appendChild(text);
    },

    show: function() {
        this.container.style.visibility = 'visible';
    },

    hide: function() {
        this.container.style.visibility = 'hidden';
    }
}

module.exports = About;
