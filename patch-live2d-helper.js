(function () {
    if (typeof Live2DHelper === 'undefined' || !Live2DHelper.prototype) {
        return;
    }

    const originalStop = Live2DHelper.prototype.stopTurnHead;
    Live2DHelper.prototype.stopTurnHead = function (no) {
        if (no == null) {
            no = 0;
        }

        if (typeof this.viewPointer === 'function') {
            this.viewPointer(0, 0);
        }

        this.live2DMgr.models[no].setDragMgr(null);
    };

    Live2DHelper.prototype.startPointer = function () {
        if (typeof this.modelStartPointer === 'function') {
            this.modelStartPointer(this.pModel);
        }
        return this;
    };
})();
