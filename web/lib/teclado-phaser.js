/* =====================================================================
   Arreglo del teclado de Phaser 3.70 (se carga justo después de Phaser).

   Con cada tecla, Phaser vuelve a procesar toda la cola de eventos del fotograma y solo
   descarta el último evento repetido. Si en un mismo fotograma llegan varias teclas (una
   pulsación muy corta, dos teclas casi a la vez), las anteriores se emitían otra vez: un
   menú podía bajar dos opciones o una carta girarse dos veces.
   Aquí cada escena recuerda qué eventos ya procesó y solo ve los nuevos.
   ===================================================================== */
(function () {
    const KP = Phaser.Input.Keyboard.KeyboardPlugin.prototype;
    const original = KP.update;
    KP.update = function () {
        const manager = this.manager;
        const cola = manager && manager.queue;
        if (!cola || !cola.length) return original.call(this);
        if (!this._procesados) this._procesados = new WeakSet();
        const nuevos = cola.filter((e) => !this._procesados.has(e));
        if (!nuevos.length) return undefined;
        nuevos.forEach((e) => this._procesados.add(e));
        manager.queue = nuevos;
        try { return original.call(this); } finally { manager.queue = cola; }
    };
})();
