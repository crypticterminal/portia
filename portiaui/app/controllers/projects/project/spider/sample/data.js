import Ember from 'ember';
import {getColors} from '../../../../../utils/colors';

export default Ember.Controller.extend({
    dispatcher: Ember.inject.service(),
    uiState: Ember.inject.service(),

    selectionModeIcons: {
        select: 'tool-select',
        add: 'tool-add',
        remove: 'tool-remove',
        edit: 'tool-multiple'
    },

    magicToolActive: Ember.computed.alias('uiState.selectedTools.magicToolActive'),
    hoveredElement: Ember.computed.readOnly('uiState.viewPort.hoveredElement'),
    originalSelectedElement: Ember.computed.alias('uiState.viewPort.originalSelectedElement'),
    sample: Ember.computed.readOnly('model'),
    selectedModel: Ember.computed.alias('uiState.viewPort.selectedModel'),
    selectionMode: Ember.computed.alias('uiState.selectedTools.selectionMode'),

    hoveredModels: Ember.computed(
        'uiState.viewPort.hoveredModels', 'hoveredElement', 'sample.dataStructure.annotations', {
            get(key) {
                const hoveredModels = this.get('uiState.viewPort.hoveredModels');
                if (hoveredModels !== this._hoveredModels) {
                    return this.set(key, hoveredModels);
                }
                const hoveredElement = this.get('hoveredElement');
                let models;
                if (hoveredElement) {
                    const annotations = this.get('sample.dataStructure.annotations');
                    models = annotations && annotations.get(Ember.guidFor(hoveredElement));
                }
                models = (models || []).filterBy('constructor.modelName', 'annotation');
                return this.set(key, models);
            },

            set(key, value) {
                this._hoveredModels = value;
                return this.set('uiState.viewPort.hoveredModels', value);
            }
        }),

    selectedModelElements: Ember.computed('selectedModel.elements', function() {
        return this.get('selectedModel.elements') || [];
    }),

    selectedElement: Ember.computed(
        'uiState.viewPort.selectedElement', 'selectedModelElements.[]', {
            get() {
                const selectedElement = this.get('uiState.viewPort.selectedElement');
                const selectedModelElements = this.get('selectedModelElements');
                if (selectedElement && selectedModelElements.includes(selectedElement)) {
                    return selectedElement;
                }
                return this.set('selectedElement', selectedModelElements[0]);
            },

            set(key, value) {
                return this.set('uiState.viewPort.selectedElement', value);
            }
        }),

    activeSelectionMode: Ember.computed(
        'selectionMode', 'magicToolActive',
        'hoveredElement', 'hoveredModels.[]', 'selectedElement', 'selectedModel',
        'selectedModelElements.length',
        'generalizableModel', function() {
            const selectedMode = this.get('selectionMode');
            const magicToolActive = this.get('magicToolActive');
            if (selectedMode) {
                return selectedMode;
            } else if (magicToolActive) {
                const hoveredElement = this.get('hoveredElement');
                const hoveredModels = this.get('hoveredModels');
                const selectedModel = this.get('selectedModel');
                if (hoveredModels.length) {
                    if (hoveredModels.includes(selectedModel)) {
                        if (this.get('selectedModelElements.length') === 1) {
                            return 'remove';
                        }
                        return 'edit';
                    } else {
                        return 'select';
                    }
                } else if (hoveredElement) {
                    if (this.get('generalizableModel') ||
                        (selectedModel && this.get('selectedModelElements.length') === 0)) {
                        return 'edit';
                    }
                    return 'add';
                }
                return 'select';
            }
        }),
    annotationColors: Ember.computed(
        'sample.orderedAnnotations.length', 'activeSelectionMode', 'hoveredElement', function() {
            const annotations = this.getWithDefault('sample.orderedAnnotations.length', 0);
            if (this.get('activeSelectionMode') === 'add' && this.get('hoveredElement')) {
                return getColors(annotations + 1);
            }
            if (annotations) {
                return getColors(annotations);
            }
            return [];
        }),
    generalizableModel: Ember.computed(
        'selectedModel', 'hoveredElement',
        'sample.orderedAnnotations.@each.selectorGenerator', function() {
            const selectedModel = this.get('selectedModel');
            const hoveredElement = this.get('hoveredElement');
            if (!hoveredElement) {
                return;
            }

            if (selectedModel) {
                const selectorGenerator = selectedModel.get('selectorGenerator');
                if (selectorGenerator) {
                    const distance = selectorGenerator.generalizationDistance(hoveredElement);
                    if (distance < Infinity) {
                        return selectedModel;
                    }
                }
            }

            const annotations = this.get('sample.orderedAnnotations');
            if (annotations.length) {
                const possibilities = annotations.map(annotation => {
                    const selectorGenerator = annotation.get('selectorGenerator');
                    const distance = selectorGenerator ?
                        selectorGenerator.generalizationDistance(hoveredElement) :
                        Infinity;
                    return {
                        annotation,
                        distance
                    };
                }).sortBy('distance');
                const {annotation, distance} = possibilities[0];
                if (distance < Infinity) {
                    return annotation;
                }
            }
        }),
    hoverOverlayColor: Ember.computed(
        'showHoverOverlay', 'annotationColors.length', 'hoveredModels.firstObject.orderedIndex',
        'generalizableModel.orderedIndex', 'selectedModel.orderedIndex', 'activeSelectionMode',
        function() {
            if (this.get('showHoverOverlay')) {
                const colors = this.getWithDefault('annotationColors', []);
                const activeSelectionMode = this.get('activeSelectionMode');
                if (activeSelectionMode === 'add') {
                    return colors.get('lastObject');
                } else if (activeSelectionMode === 'select' || activeSelectionMode === 'remove') {
                    return colors[this.get('hoveredModels.firstObject.orderedIndex')];
                } else if (activeSelectionMode === 'edit') {
                    return colors[this.get('selectedModel.orderedIndex')] ||
                        colors[this.get('generalizableModel.orderedIndex')];
                }
            }
        }),
    showHoverOverlay: Ember.computed(
        'hoveredElement', 'hoveredModels.[]', 'generalizableModel', 'selectedModel',
        'activeSelectionMode', function() {
            const activeSelectionMode = this.get('activeSelectionMode');
            const hoveredElement = this.get('hoveredElement');
            const hoveredModels = this.get('hoveredModels');
            if (hoveredElement) {
                if (activeSelectionMode === 'add') {
                    return true;
                } else if ((activeSelectionMode === 'select' || activeSelectionMode === 'remove') &&
                        hoveredModels.length) {
                    return true;
                } else if (activeSelectionMode === 'edit' &&
                        (this.get('selectedModel') || this.get('generalizableModel'))) {
                    return true;
                }
            }
            return false;
        }),

    actions: {
        toggleMagicTool() {
            const magicToolActive = this.get('magicToolActive');
            const selectionMode = this.get('selectionMode');
            if (magicToolActive) {
                this.set('magicToolActive', false);
                if (!selectionMode) {
                    this.set('selectionMode', 'add');
                }
            } else {
                this.setProperties({
                    magicToolActive: true,
                    selectionMode: null
                });
            }
        },

        selectElement() {
            const dispatcher = this.get('dispatcher');
            const magicToolActive = this.get('magicToolActive');
            const selectionMode = this.get('activeSelectionMode');
            const hoveredElement = this.get('hoveredElement');
            const hoveredModels = this.get('hoveredModels');
            const selectedModel = this.get('selectedModel');

            switch (selectionMode) {
                case 'select':
                    if (hoveredModels.length) {
                        const model = hoveredModels[0];
                        dispatcher.selectAnnotationElement(
                            model, hoveredElement, /* redirect = */true);
                    } else {
                        dispatcher.clearSelection();
                    }
                    break;

                case 'add':
                    if (hoveredElement) {
                        dispatcher.addAnnotation(
                            /* auto item */null, hoveredElement, undefined, /* redirect = */true);
                    } else {
                        dispatcher.clearSelection();
                    }
                    break;

                case 'remove':
                    if (selectedModel) {
                        dispatcher.removeAnnotation(selectedModel);
                    } else if (hoveredModels.length) {
                        dispatcher.removeAnnotation(hoveredModels[0]);
                    } else {
                        dispatcher.clearSelection();
                    }
                    break;

                case 'edit':
                    const matchingModel = selectedModel || this.get('generalizableModel');
                    if (!hoveredElement) {
                        dispatcher.clearSelection();
                    } else if (matchingModel && !hoveredModels.includes(matchingModel)) {
                        dispatcher.addElementToAnnotation(matchingModel, hoveredElement);
                    } else if (hoveredModels.length) {
                        let model;
                        if (selectedModel) {
                            model = selectedModel;
                        } else {
                            model = hoveredModels.find(model =>
                                    (model.get('elements') || []).length > 1) ||
                                hoveredModels[0];
                        }
                        dispatcher.removeElementFromAnnotation(model, hoveredElement);
                    }
                    break;
            }

            if (magicToolActive) {
                this.set('selectionMode', null);
            }
        }
    }
});
