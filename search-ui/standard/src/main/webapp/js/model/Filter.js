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
    'backbone',
    'underscore',
    'moment',
    'jquery',
    'properties'
], function(Backbone, _, moment,$, Properties) {
    "use strict";

    var CQL_DATE_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss[Z]';

    var Filter = {};

    Filter.OPERATIONS = {
        'string': ['contains','equals','startsWith','endsWith'],
        'date': ['before','after'],
        'number': ['=','!=','>','>=','<','<='],
        'anyGeo': ['intersects','contains']
    };


    var fieldNameAlias = {
        'metacard-type': 'metacard_type_name'
    };

    var excludeFromCQL = [Properties.filters.SOURCE_ID];

    Filter.CQLFactory = {
        toCQL: function(filter){
            var fieldName = filter.get('fieldName');
            var fieldType = filter.get('fieldType');
            var fieldOperator = filter.get('fieldOperator');
            if(!_.contains(excludeFromCQL, fieldName) && Filter.CQLFactory[fieldType] && Filter.CQLFactory[fieldType][fieldOperator]){
                return "(" + Filter.CQLFactory[fieldType][fieldOperator](filter) + ")"; // fun
            }
            return null;
        },

        getValue: function(value) {
            switch (typeof value) {
                case 'string':
                    if(moment(value).isValid()){
                        return moment(value).format(CQL_DATE_FORMAT);
                    }
                    return "'" + value.replace(/'/g, "''") + "'";
                case 'number':
                    return String(value);
                case 'object':
                    if (_.isDate(value)) {
                        return moment(value).format(CQL_DATE_FORMAT);
                    } else {
                        throw new Error("Can't write object to CQL: " + value);
                    }
                    break;
                default:
                    throw new Error("Can't write value to CQL: " + value);
            }
        },

        formatFieldName: function(fieldName){
            if(_.has(fieldNameAlias, fieldName)){
                return '"' + fieldNameAlias[fieldName] + '"';
            } else if(fieldName === 'anyType'){
                return fieldName;
            }
            return '"' + fieldName + '"';
        },

        string: {
            'equals': function(filter){
                return Filter.CQLFactory.formatFieldName(filter.get('fieldName')) + ' = ' + Filter.CQLFactory.getValue(filter.get('stringValue1'));
            },
            'startsWith': function(filter){
                throw new Error("Not implemented yet." + filter);
            },
            'endsWith': function(filter){
                throw new Error("Not implemented yet." + filter);
            },
            'contains': function(filter){
                if(filter.get('fieldName') === Properties.filters.METADATA_CONTENT_TYPE){
                    var split = filter.get('stringValue1').split(',');
                    var joinArray = [];
                    _.each(split, function(subContentType){
                        joinArray.push(Filter.CQLFactory.formatFieldName(filter.get('fieldName')) + ' ILIKE ' + Filter.CQLFactory.getValue(subContentType));
                    });
                    return joinArray.join(' OR ');
                } else {
                    return Filter.CQLFactory.formatFieldName(filter.get('fieldName')) + ' ILIKE ' + Filter.CQLFactory.getValue(filter.get('stringValue1'));
                }

            }
        },
        date: {
            'before': function(filter){
                return Filter.CQLFactory.formatFieldName(filter.get('fieldName')) + ' BEFORE ' + Filter.CQLFactory.getValue(filter.get('dateValue1'));
            },
            'after': function(filter){
                return Filter.CQLFactory.formatFieldName(filter.get('fieldName')) + ' AFTER ' + Filter.CQLFactory.getValue(filter.get('dateValue1'));
            }
        },
        number: {
            '=': function (filter) {
                throw new Error("Not implemented yet." + filter);
            },
            '!=': function (filter) {
                throw new Error("Not implemented yet." + filter);
            },
            '>': function (filter) {
                throw new Error("Not implemented yet." + filter);
            },
            '>=': function (filter) {
                throw new Error("Not implemented yet." + filter);
            },
            '<': function (filter) {
                throw new Error("Not implemented yet." + filter);
            },
            '<=': function (filter) {
                throw new Error("Not implemented yet." + filter);
            }
        },
        anyGeo: {
            'contains': function(filter) {
                return 'DWITHIN(anyGeo, ' + filter.get('geoValue1') + ', meters)';
            },
            'intersects': function(filter) {
                return 'INTERSECTS(anyGeo, ' + filter.get('geoValue1') + ')';
            }
        }
    };


    Filter.Model = Backbone.Model.extend({
        defaults: {
            fieldName: null,
            fieldType: null,
            fieldOperator: null,
            stringValue1: '',
            dateValue1: '',
            numberValue1: ''
        },
        toCQL: function(){
            return Filter.CQLFactory.toCQL(this);
        }
    });

    Filter.Collection = Backbone.Collection.extend({
        model: Filter.Model,
        toCQL: function(){
            var cqlArray = this.map(function(model){
                if(!_.contains(excludeFromCQL,model.get('fieldName'))){
                    return model.toCQL();
                }
            });
            cqlArray = _.compact(cqlArray);
            return cqlArray.join(' AND ');  // TODO this needs to support OR at some point for content type.
        },
        trimUnfinishedFilters: function(){
            var unfinished = this.filter(function(filter){

                // sorry this is messy.  I basically want a way to trim all filters that don't have values.
                var type = filter.get('fieldType');
                var stringValue1 = $.trim(filter.get('stringValue1'));
                var dateValue1 = $.trim(filter.get('dateValue1'));
                var numberValue1 = $.trim(filter.get('numberValue1'));
                var geoValue1 = $.trim(filter.get('geoValue1'));
                var hasString = type === 'string' && stringValue1 && stringValue1 !== '';
                var hasNumber = type === 'number' && numberValue1 && numberValue1 !== '';
                var hasDate = type === 'date' && dateValue1 && dateValue1 !== '';
                var hasGeo = type === 'anyGeo' && geoValue1 && geoValue1 !== '';
                if(hasNumber || hasString || hasDate || hasGeo){
                    return false; // no value value.
                }
                return true;
            });
            this.remove(unfinished);
        },


        getGroupedFilterValues: function(fieldName){
            var groupedFilterValues = [];
            var existingFilters = this.where({fieldName: fieldName});
            _.each(existingFilters, function(existingFilter){
                var existingFilterString = existingFilter.get('stringValue1');  // we will assume string for group filters
                if(existingFilterString && existingFilterString !== ''){
                    var parsedIds = existingFilterString.split(',');
                    _.each(parsedIds, function(parsedId){
                        groupedFilterValues.push(parsedId);
                    });
                }
            });
            return _.uniq(groupedFilterValues);
        },

        addValueToGroupFilter: function(fieldName, value){
            var existingFilters = this.where({fieldName: fieldName});
            var groupedFilterValues = [];
            _.each(existingFilters, function(existingFilter){
                var existingFilterString = existingFilter.get('stringValue1');  // we assume string group filters.
                if(existingFilterString && existingFilterString !== ''){
                    var parsedIds = existingFilterString.split(',');
                    _.each(parsedIds, function(parsedId){
                        if(parsedId !== value){
                            groupedFilterValues.push(parsedId);
                        }
                    });
                }
            });
            groupedFilterValues.push(value);
            this.remove(existingFilters);
            this.add(new Filter.Model({
                fieldName: fieldName,
                fieldType: 'string',
                fieldOperator: 'contains',
                stringValue1: groupedFilterValues.join(',')
            }));
        },

        removeValueFromGroupFilter: function(fieldName, value){
            var existingFilters = this.where({fieldName: fieldName});
            var groupedFilterValues = [];
            _.each(existingFilters, function(existingFilter){
                var existingFilterString = existingFilter.get('stringValue1'); // we assume string group filters.
                if(existingFilterString && existingFilterString !== ''){
                    var parsedIds = existingFilterString.split(',');
                    _.each(parsedIds, function(parsedId){
                        if(parsedId !== value){
                            groupedFilterValues.push(parsedId);
                        }
                    });
                }
            });
            this.remove(existingFilters);
            this.add(new Filter.Model({
                fieldName: fieldName,
                fieldType: 'string',
                fieldOperator: 'contains',
                stringValue1: groupedFilterValues.join(',')
            }));
        },

        replaceGroupFilter: function(fieldName, value){
            var existingFilters = this.where({fieldName: fieldName});
            this.remove(existingFilters);
            this.add(new Filter.Model({
                fieldName: fieldName,
                fieldType: 'string',
                fieldOperator: 'contains',
                stringValue1: value
            }));
        }
    });

    return Filter;
});