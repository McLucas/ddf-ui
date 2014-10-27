/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either
 * version 3 of the License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Lesser General Public License for more details. A copy of the GNU Lesser General Public License is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global define*/

define([
        'marionette',
        'backbone',
        'underscore',
        'icanhaz',
        'direction',
        'spin',
        'spinnerConfig',
        'wreqr',
        './filter/FilterLayout.view',
        'text!templates/resultlist/resultListItem.handlebars',
        'text!templates/resultlist/resultList.handlebars',
        'text!templates/resultlist/countlow.handlebars',
        'text!templates/resultlist/counthigh.handlebars',
        'text!templates/resultlist/statusItem.handlebars',
        'text!templates/resultlist/status.handlebars',
        'properties'
    ],
    function (Marionette, Backbone, _, ich, dir, Spinner, spinnerConfig, wreqr, FilterLayoutView,resultListItemTemplate, resultListTemplate, countLowTemplate, countHighTemplate, statusItemTemplate, statusTemplate, properties) {
        "use strict";

        var List = {};

        function throwError(message, name) {
          var error = new Error(message);
          error.name = name || 'Error';
          throw error;
        }

        ich.addTemplate('resultListItem', resultListItemTemplate);
        ich.addTemplate('resultListTemplate', resultListTemplate);
        ich.addTemplate('countLowTemplate', countLowTemplate);
        ich.addTemplate('countHighTemplate', countHighTemplate);
        ich.addTemplate('statusItemTemplate', statusItemTemplate);
        ich.addTemplate('statusTemplate', statusTemplate);

        List.MetacardRow = Marionette.ItemView.extend({
            tagName: "tr",
            template : 'resultListItem',
            events: {
                'click .metacard-link': 'viewMetacard',
                'click #select-record-checkbox': 'changeRecordSelection'
            },

            resultSelect: false,

            initialize: function() {
                this.listenTo(wreqr.vent, 'search:resultsselect', this.resultSelectMode);
                this.listenTo(wreqr.vent, 'search:resultssave', this.resultSaveMode);
            },

            changeRecordSelection: function(e) {
                this.model.set('selectedForSave', e.target.checked);
            },

            resultSelectMode: function() {
                this.resultSelect = true;
                this.render();
            },

            resultSaveMode: function() {
                this.resultSelect = false;
                this.render();
            },

            serializeData: function(){
                //we are overriding this serializeData function to change marionette's behavior
                //previously it was performing a .toJSON on the model which is normally what you want
                //but our model is pretty deep and this was causing some big performance issues
                //so with this change we simply need up adapt our templates to work with backbone
                //objects instead of flat json records
                var data = {};

                if (this.model) {
                    data = this.model;
                }

                return _.extend(data, {resultSelect: this.resultSelect});
            },

            onRender : function(){
                if(this.model.get('context')){
                    this.$el.addClass('selected');
                }
            },

            viewMetacard: function () {
                wreqr.vent.trigger('metacard:selected', dir.forward, this.model);
            }

        });

        List.MetacardTable = Marionette.CollectionView.extend({
            itemView : List.MetacardRow,
            tagName: 'table',
            className: 'table resultTable',
            itemViewOptions : function(model){
                return {
                    model : model.get('metacard')
                };
            },
            appendHtml: function (collectionView, itemView, index) {
                var childAtIndex;

                if (collectionView.isBuffering) {
                    // could just quickly
                    // use prepend
                    if (index === 0) {
                        collectionView._bufferedChildren.reverse();
                        collectionView._bufferedChildren.push(itemView);
                        collectionView._bufferedChildren.reverse();
                        if(collectionView.elBuffer.firstChild) {
                            return collectionView.elBuffer.insertBefore(itemView.el, collectionView.elBuffer.firstChild);
                        } else {
                            return collectionView.elBuffer.appendChild(itemView.el);
                        }
                    } else {
                        // see if there is already
                        // a child at the index
                        childAtIndex = collectionView.$el.children().eq(index);
                        if (childAtIndex.length) {
                            return childAtIndex.before(itemView.el);
                        } else {
                            return collectionView.elBuffer.appendChild(itemView.el);
                        }
                    }
                } else {
                    // If we've already rendered the main collection, just
                    // append the new items directly into the element.
                    var $container = this.getItemViewContainer(collectionView);
                    if (index === 0) {
                        $container.empty();
                        return $container.prepend(itemView.el);
                    } else {
                        // see if there is already
                        // a child at the index
                        childAtIndex = $container.children().eq(index);
                        if (childAtIndex.length) {
                            return childAtIndex.before(itemView.el);
                        } else {
                            return $container.append(itemView.el);
                        }
                    }
                }
            },
            getItemViewContainer: function(containerView){
                if ("$itemViewContainer" in containerView){
                    return containerView.$itemViewContainer;
                }

                var container;
                var itemViewContainer = Marionette.getOption(containerView, "itemViewContainer");
                if (itemViewContainer) {
                    var selector = _.isFunction(itemViewContainer) ? itemViewContainer.call(this) : itemViewContainer;
                    container = containerView.$(selector);
                    if (container.length <= 0) {
                        throwError("The specified `itemViewContainer` was not found: " + containerView.itemViewContainer, "ItemViewContainerMissingError");
                    }
                } else {
                    container = containerView.$el;
                }

                containerView.$itemViewContainer = container;
                return container;
            }
        });

        List.StatusRow = Marionette.ItemView.extend({
            events: {
                'click .hit-count-text':'hitCountClicked',
                'click .remove':'removedClicked'
            },
            tagName: 'tr',
            template: 'statusItemTemplate',
            modelEvents: {
                "change": "render"
            },
            hitCountClicked: function(){

                var valueCount = this.model.get('hit-count');
                var fieldValue = this.model.get('id');
                var fieldName = 'source-id';

                wreqr.vent.trigger('facetSelected', {
                    valueCount: valueCount,
                    fieldValue: fieldValue,
                    fieldName: fieldName
                });

            },
            removedClicked: function(){
                wreqr.vent.trigger('requestSourceFilterRemoved', this.model.get('id'));
            }
        });
    
        List.StatusTable = Marionette.CompositeView.extend({
            template: 'statusTemplate',
            itemView : List.StatusRow,
            itemViewContainer: '.included tbody',
            events: {
                'click #status-icon': 'toggleStatus',
                'click #refresh-icon': 'refreshResults',
                'click .add': 'addSourceClicked'
            },
            initialize: function() {

                var includedSourceIds = this.collection.pluck('id');
                var excludedSources = new Backbone.Collection(this.options.sources.filter(function(source){
                    return !_.contains(includedSourceIds, source.get('id'));
                })).toJSON();

                _.each(excludedSources, function(excludedSource){
                    excludedSource.isExcluded = true;
                });


                if (this.collection) {
                    this.listenTo(this.collection, 'change', this.setRefreshIcon);
                }
            },
            serializeData: function(){
                var includedSourceIds = this.collection.pluck('id');
                var excludedSources = new Backbone.Collection(this.options.sources.filter(function(source){
                    return !_.contains(includedSourceIds, source.get('id'));
                })).toJSON();


                return {
                    excludedSources: excludedSources
                };
            },
            toggleStatus: function() {
                this.$('#status-table').toggleClass('shown hidden');
                this.$('#status-icon').toggleClass('fa-caret-down fa-caret-right');
                wreqr.vent.trigger('toggleFilterMenu');
            },
            initFromFilter: function(){
                var showFilter = wreqr.reqres.request('getShowFilterFlag');
                if(showFilter){
                    this.toggleStatus();  // this should enable it.
                }
            },
            refreshResults: function() {
                if (!this.isSearchRunning()) {
                    this.collection.parents[0].parents[0].startSearch();
                }
            },
            toggleFilter: function(){
                wreqr.vent.trigger('toggleFilterMenu');
            },
            onRender: function() {
                this.setRefreshIcon();
                this.initFromFilter();
            },
            setRefreshIcon: function() {
                if (this.isSearchRunning()) {
                    this.$('#refresh-icon').removeClass('fa-refresh');
                    this.$('#refresh-icon').addClass('fa-circle-o-notch fa-spin');
                } else {
                    this.$('#refresh-icon').removeClass('fa-circle-o-notch fa-spin');
                    this.$('#refresh-icon').addClass('fa-refresh');
                }
            },
            isSearchRunning: function() {
                var working = false;
                this.collection.forEach(function (source) {
                    if (source.get('state') === "ACTIVE") {
                        working = true;
                    }
                });
                return working;
            },
            addSourceClicked: function(evt){
                var sourceIdToAdd = this.$(evt.currentTarget).attr('data-source-id');
                this.collection.parents[0].parents[0].filters.addSourceId(sourceIdToAdd);
                this.collection.parents[0].parents[0].startSearch();
            }
        });
    
        List.CountView = Marionette.ItemView.extend({
            modelEvents: {
                "change": "render"
            },
            serializeData: function() {
                var count = 0;
                if (this.model.has('results')) {
                    count = this.model.get('results').length;
                }
                return _.extend(this.model.toJSON(), {resultCount: properties.resultCount, count: count});
            },
            getTemplate: function() {
                if (!_.isUndefined(this.model.get('hits'))) {
                    if (!this.model.get('results') || properties.resultCount >= this.model.get('hits') || this.model.get('hits') === 0) {
                        return 'countLowTemplate';
                    } else {
                        return 'countHighTemplate';
                    }
                }
            }
        });

        List.MetacardListView = Marionette.Layout.extend({
            className: 'slide-animate height-full',
            template: 'resultListTemplate',
            regions: {
                countRegion: '.result-count',
                listRegion: '#resultList',
                statusRegion: '#result-status-list',
                filterRegion: '.filter-region'
            },
            modelEvents: {
                'change': 'render'
            },
            spinner: new Spinner(spinnerConfig),
            initialize: function() {
                this.listenTo(wreqr.vent, 'search:resultssave', this.saveSelectedRecords);
            },
            onRender: function () {
                var view = this;
                view.listRegion.show(new List.MetacardTable({
                    collection: view.model.get("results")
                }));
                if(view.model.get("status")) {
                    wreqr.reqres.request('getSourcePromise').then(function(sources){
                        view.statusRegion.show(new List.StatusTable({
                            collection: view.model.get("status"),
                            sources: sources
                        }));
                    }).done();
                }
                view.countRegion.show(new List.CountView({
                    model: view.model
                }));
                view.filterRegion.show(new FilterLayoutView({
                    model: view.model
                }));
            },
            onShow: function(){
                this.updateSpinner();
                this.updateScrollbar();
                this.updateScrollPos();
            },
            onClose: function() {
                this.spinner.stop();
            },
            updateSpinner: function () {
                if (!_.isUndefined(this.model.get("hits")) ||
                    (this.model.get('results') && this.model.get('results').length > 0)) {
                    this.spinner.stop();
                } else {
                    this.spinner.spin(this.el);
                }
            },
            updateScrollbar: function () {
                var view = this;
                // defer seems to be necessary for this to update correctly
                _.defer(function () {
                    view.$el.perfectScrollbar('update');
                });
            },
            updateScrollPos: function() {
                var view = this;
                _.defer(function () {
                    var selected = view.$el.find('.selected');
                    var container = view.$el.parent();
                    if(selected.length !== 0)
                    {
                        container.scrollTop(selected.offset().top - container.offset().top + container.scrollTop());
                    }
                });
            },
            saveSelectedRecords: function() {
                var records = this.model.get('results').where({'metacard.selectedForSave': true});
                if(records && records.length) {
                    _.each(records, function (record) {
                        record.unset('metacard.selectedForSave');
                    });
                    wreqr.vent.trigger('workspace:saveresults', undefined, records);
                }
            }
        });

        return List;

});
