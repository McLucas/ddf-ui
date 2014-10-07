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
/*global define */
define([
    'jquery',
    'underscore',
    'marionette',
    'wreqr',
    'moment'
], function ($, _, Marionette, wreqr, moment) {
        'use strict';
        var FilterController;

        FilterController = Marionette.Controller.extend({
            initialize: function (options) {
                _.bindAll(this);
                this.query = options.query;

                this.fields = [];
                this.facetCounts = {};

                wreqr.reqres.setHandler('getFields', this.getFields);
                wreqr.reqres.setHandler('getFacetCounts', this.getFacetCounts);
                this.listenTo(wreqr.vent,'processSearch', this.processSearch);

            },

            getFacetCounts: function(){
                return this.facetCounts;
            },

            getFields: function(){
                console.log(this.fields);
                return this.fields;
            },

            processSearch: function(searchToProcess){
                var array = [{name: 'anyText', type: 'string'},{name: 'anyGeo', type: 'anyGeo'}]; // default all field
                var facetCounts = {};

                // time to iterate through the results and metacards to build our field list and facet list.
                // TODO this should be refactored once
                if(searchToProcess.get('results')){
                    searchToProcess.get('results').each(function(item){
                        var pairs = item.get('metacard').get('properties').pairs();
                        _.each(pairs, function(pair){
                            var currentFieldNames = _.pluck(array, 'name');

                            if(!_.contains(currentFieldNames, pair[0])){
                                // doesn't exist.  lets add.
                                var fieldObj = {
                                    name: pair[0],
                                    type: typeof pair[1]
                                };

                                // lets see if we need to convert type to a date.
                                if(moment(pair[1]).isValid()){
                                    fieldObj.type = 'date';
                                }
                                array.push(fieldObj);
                            }

                            // lets add the field-facet if it does not exist.
                            if(!_.has(facetCounts, pair[0])){
                                facetCounts[pair[0]] = {};
                            }
                            // lets increment the facet value.  If none exist, create one with value of 1.
                            if(_.has(facetCounts[pair[0]],pair[1])){
                                facetCounts[pair[0]][pair[1]]++;
                            } else {
                                facetCounts[pair[0]][pair[1]] = 1;
                            }
                        });
                    });
                }
                this.registerFields(array);
                this.registerFacetCounts(facetCounts);
            },

            registerFields: function(newFields){
                var that = this;
                _.each(newFields, function(newField){
                    console.log('testing' + newField);
                    var currentFieldNames = _.pluck(that.fields, 'name');
                    if(!_.contains(currentFieldNames, newField.name)){
                        that.fields.push(newField);
                    }
                });
            },

            registerFacetCounts: function(facetCounts){
                this.facetCounts = _.pick(facetCounts,['metadata-content-type','source-id', 'metacard-type']);
            }

        });

        return FilterController;
    }
);
