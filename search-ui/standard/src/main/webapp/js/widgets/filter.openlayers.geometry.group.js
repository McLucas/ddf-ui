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
define([
        'marionette',
        'backbone',
        'openlayers',
        'underscore',
        'wreqr'
    ],
    function (Marionette, Backbone, ol, _, wreqr) {
        "use strict";

        var FilterGeometryGroup = {};

        var FilterGeometryItem = Backbone.View.extend({
            initialize: function(options){
                this.options = options;
                this.listenTo(this.model, 'change', this.updatePrimative);
            },
            // this will manipulate the map.
            render: function(){
                this.updatePrimative();
                return this;
            },
            remove: function(){
                this.cleanUpPrimative();
                Backbone.View.prototype.remove.apply(this, arguments);
            },
            cleanUpPrimative: function() {
                if(this.primitive){
                    this.options.vectorSource.removeFeature(this.primitive);
                    this.primitive = null;
                }
            },
            updatePrimative: function(){
                this.cleanUpPrimative();
                var geoType = this.model.get('geoType');
                if(geoType === 'polygon'){
                    this.primitive = this.createPolygonPrimitive();
                } else if(geoType === 'circle') {
                    this.primitive = this.createCirclePrimitive();
                } else if(geoType === 'bbox'){
                    this.primitive = this.createBboxPrimitive();
                }

                if(this.primitive) {
                    this.options.vectorSource.addFeature(this.primitive);
                }
            },

            modelToRectangle: function () {
                var northWest = ol.proj.transform([this.model.get('west'), this.model.get('north')], 'EPSG:4326', 'EPSG:3857');
                var northEast = ol.proj.transform([this.model.get('east'), this.model.get('north')], 'EPSG:4326', 'EPSG:3857');
                var southWest = ol.proj.transform([this.model.get('west'), this.model.get('south')], 'EPSG:4326', 'EPSG:3857');
                var southEast = ol.proj.transform([this.model.get('east'), this.model.get('south')], 'EPSG:4326', 'EPSG:3857');
                var coords = [];
                coords.push(northWest);
                coords.push(northEast);
                coords.push(southEast);
                coords.push(southWest);
                coords.push(northWest);
                var rectangle = new ol.geom.LineString(coords);
                return rectangle;
            },

            modelToPolygon: function () {
                var polygon = this.model.get('polygon');
                var coords = [];
                if (polygon) {
                    _.each(polygon, function (item) {
                        coords.push(ol.proj.transform([item[0], item[1]], 'EPSG:4326', 'EPSG:3857'));
                    });
                }

                var rectangle = new ol.geom.LineString(coords);
                return rectangle;
            },

            createBboxPrimitive: function(){
                var rectangle = this.modelToRectangle();
                if (!rectangle) {
                    // handles case where model changes to empty vars and we don't want to draw anymore
                    return;
                }

                if(this.vectorLayer) {
                    this.map.removeLayer(this.vectorLayer);
                }

                var billboard = new ol.Feature({
                    geometry: rectangle
                });

                var iconStyle = new ol.style.Style({
                    stroke: new ol.style.Stroke({color: '#914500', width: 3})
                });
                billboard.setStyle(iconStyle);
                return billboard;
            },

            createCirclePrimitive: function(){
                return null;
            },

            createPolygonPrimitive: function(){

                var polygon = this.modelToPolygon();

                if (!polygon) {
                    // handles case where model changes to empty vars and we don't want to draw anymore
                    return;
                }

                var billboard = new ol.Feature({
                    geometry: polygon
                });

                var iconStyle = new ol.style.Style({
                    stroke: new ol.style.Stroke({color: '#914500', width: 3})
                });
                billboard.setStyle(iconStyle);

                return billboard;
            }

        });

        var FilterGeometryCollection = Marionette.CollectionView.extend({
            // this will control the collection via crud events through the model.
            itemView: FilterGeometryItem,
            itemViewOptions: function(){
                return {
                    geoController: this.options.geoController,
                    vectorSource: this.vectorSource
                };
            },
            initialize: function(){
                this.vectorSource = new ol.source.Vector({
                    features: []
                });

                this.vectorLayer = new ol.layer.Vector({
                    source: this.vectorSource
                });
                this.options.geoController.mapViewer.addLayer(this.vectorLayer);
            },
            onClose: function(){
                this.options.geoController.mapViewer.removeLayer(this.vectorLayer);
            }
        });

        FilterGeometryGroup.Controller = Marionette.Controller.extend({
            initialize: function(options){
                this.options = options;
                this.listenTo(wreqr.vent, 'mapfilter:showFilters', this.showFilters);
            },
            showFilters: function(filters){
                if(this.view){
                    this.view.close();
                }

                this.view = new FilterGeometryCollection({
                    geoController: this.options.geoController,
                    collection: filters
                });
                this.view.render();
            }
        });

        return FilterGeometryGroup;
    });