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
    'jquery',
    'underscore',
    'marionette',
    'icanhaz',
    'wreqr',
    'moment',
    'properties',
    'js/model/Filter',
    './FacetCollection.view',
    './FilterCollection.view',
    'text!templates/filter/filter.layout.handlebars'
],
    function ($, _, Marionette, ich, wreqr, moment, Properties, Filter, FacetCollectionView,FilterCollectionView, filterLayoutTemplate) {
        "use strict";

        ich.addTemplate('filterLayoutTemplate', filterLayoutTemplate);

        var FilterView = Marionette.Layout.extend({
            template: 'filterLayoutTemplate',
            className: 'filter-view',
            events: {
                'click .add-filter':'addFilterPressed',
                'click .apply':'applyPressed',
                'click .filter-status': 'toggleFilterView'
            },
            regions: {
                facetsRegion: '.facets-region',
                filtersRegion: '.filter-region'
            },
            initialize: function(){
                var view = this;
                if(this.model.parents.length === 0){
                    return; // just quit.  This is an invalid state.
                }
                view.queryObject = this.model.parents[0];

                if(this.queryObject){
                    view.collection = this.queryObject.filters;
                } else {
                    return;  // lets just exit.
                }
                this.listenTo(wreqr.vent, 'toggleFilterMenu', this.toggleFilterVisibility);
                this.listenTo(wreqr.vent, 'facetSelected', this.addFacet);
                this.listenTo(wreqr.vent, 'facetDeSelected', this.removeFacet);
                this.listenTo(wreqr.vent, 'facetFocused', this.focusFacet);

                wreqr.vent.trigger('processSearch', this.model);
            },
            serializeData: function(){
                return {
                    filterCount: this.queryObject ? this.queryObject.filters.length : 0,
                };
            },
            onRender: function(){
                var view = this;
                var facetCounts = wreqr.reqres.request('getFacetCounts');
                var fields = wreqr.reqres.request('getFields');
                view.facetsRegion.show(new FacetCollectionView({model: view.model, facetCounts: facetCounts}));
                view.filtersRegion.show(new FilterCollectionView({model: view.model, fields: fields}));
                this.initShowFilter();
            },
            initShowFilter: function(){
                var showFilter = wreqr.reqres.request('getShowFilterFlag');
                if(showFilter){
                    this.$el.toggleClass('active', true);
                }
            },
            addFilterPressed: function(){
                var view = this;
                var fields = wreqr.reqres.request('getFields');
                var initialSelection = _.first(fields);
                view.collection.add(new Filter.Model({
                    fieldName: initialSelection.name,
                    fieldType: initialSelection.type,
                    fieldOperator: Filter.OPERATIONS[initialSelection.type][0]
                }));
            },
            applyPressed: function(){
                this.collection.trimUnfinishedFilters();
                this.queryObject.startSearch();
            },
            toggleFilterVisibility: function(){
                this.$el.toggleClass('active');
                wreqr.vent.trigger('filterFlagChanged', this.$el.hasClass('active'));
            },
            toggleFilterView: function(){
                wreqr.vent.trigger('toggleFilterMenu');
            },
            addFacet: function(facet){
                this.collection.addValueToGroupFilter(facet.fieldName, facet.fieldValue);
                this.collection.trimUnfinishedFilters();
                this.queryObject.startSearch();
            },
            removeFacet: function(facet){
                this.collection.removeValueFromGroupFilter(facet.fieldName, facet.fieldValue);
                this.collection.trimUnfinishedFilters();
                this.queryObject.startSearch();
            },
            focusFacet: function(facet){
                this.collection.replaceGroupFilter(facet.fieldName, facet.fieldValue);
                this.collection.trimUnfinishedFilters();
                this.queryObject.startSearch();
            }

        });

        return FilterView;

    });