import Ember from 'ember';

export default Ember.Service.extend({
    uiState: Ember.inject.service(),
    webSocket: Ember.inject.service(),

    items: [],

    init() {
        this._super();
        let ws = this.get('webSocket');
        ws.addCommand('extract_items', this._setItems.bind(this));
    },

    update() {
        Ember.run.throttle(this, this._getitems, 200, false);
    },

    _getitems() {
        const spiderId = this.get('uiState.models.spider.id');
        if (spiderId) {
            this.get('webSocket').send({
                _command: 'extract_items',
                project: this.get('uiState.models.project.id'),
                spider: spiderId,
                sample: this.get('uiState.models.sample.id')
            });
        }
    },

    _setItems: function(data) {
        this.set('items', data.items);
    }
});
