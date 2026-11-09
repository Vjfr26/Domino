/* Punto de entrada: espera a la fuente y arranca Phaser. */
function arrancar() {
    window.juego = new Phaser.Game({
        type: Phaser.AUTO,
        width: ANCHO,
        height: ALTO,
        parent: 'juego',
        backgroundColor: '#0b0f0d',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2 },
        scene: [Arranque, Menu, Mesa, Pausa],
    });
}

const fuente = new FontFace('Fredoka', 'url(fuente/Fredoka.ttf)', { weight: '300 700' });
fuente.load()
    .then((f) => { document.fonts.add(f); arrancar(); })
    .catch(arrancar);
