
OCM_App.prototype.initEditors = function () {
    this.editorMapInitialised = false;
    this.editorMap = null;
    this.editMarker = null;
    this.positionAttribution = null;

    var editorSubmitMethod = $.proxy(this.performLocationSubmit, this);

    $("#editlocation-form").validate({
        rules: {
            edit_addressinfo_title: {
                required: true,
                email: true
            }
        },
        submitHandler: function (form) {
            editorSubmitMethod();
        }
    });

    this.ocm_data.referenceData = this.ocm_data.getCachedDataObject("CoreReferenceData");
    if (this.ocm_data.referenceData == null) {
        this.ocm_data.fetchCoreReferenceData("ocm_app.populateEditor", this.getLoggedInUserInfo());
    } else {
        this.logEvent("Using cached reference data..");
        var _app = this;
        setTimeout(function () {
            _app.populateEditor();
        }, 50);

        setTimeout(function () {
            _app.ocm_data.fetchCoreReferenceData("ocm_app.populateEditor", _app.getLoggedInUserInfo());
        }, 1000);
    }
};

OCM_App.prototype.resetEditorForm = function () {
    document.getElementById("editlocation-form").reset();
    for (var n = 1; n <= this.numConnectionEditors; n++) {
        this.setDropdown("edit_connection" + n + "_connectiontype", "0");
        this.setDropdown("edit_connection" + n + "_level", "");
        this.setDropdown("edit_connection" + n + "_status", "0");
        this.setDropdown("edit_connection" + n + "_currenttype", "");
    }

    this.setDropdown("edit_addressinfo_countryid", 1);
    this.setDropdown("edit_operator", 1);
    this.setDropdown("edit_dataprovider", 1);
    this.setDropdown("edit_submissionstatus", 1);
    this.setDropdown("edit_statustype", 50);

    this.positionAttribution = null;
    $("#editor-map").hide();
};

OCM_App.prototype.populateEditor = function (refData) {
    this.hideProgressIndicator();

    if (refData == null) {
        refData = this.ocm_data.referenceData;
    } else {
        if (refData != null) {
            this.ocm_data.setCachedDataObject("CoreReferenceData", refData);
            this.logEvent("Updated cached CoreReferenceData.");
        }
    }

    this.ocm_data.referenceData = refData;
    this.ocm_data.sortCoreReferenceData();
    refData = this.ocm_data.referenceData;

    this.isLocationEditMode = false;

    this.populateDropdown("edit_addressinfo_countryid", refData.Countries, null);
    this.populateDropdown("edit_usagetype", refData.UsageTypes, null);
    this.populateDropdown("edit_statustype", refData.StatusTypes, null);
    this.populateDropdown("edit_operator", refData.Operators, 1);

    for (var n = 1; n <= this.numConnectionEditors; n++) {
        var $connection = ($("#edit_connection" + n));
        if (!($connection.length > 0)) {
            var templateHTML = $("#edit_connection1").html();
            if (templateHTML != null) {
                templateHTML = templateHTML.replace("Equipment Details 1", "Equipment Details " + n);
                templateHTML = templateHTML.replace(/connection1/gi, "connection" + n);

                $connection = $("<div id=\"edit_connection" + n + "\" class='panel panel-default'>" + templateHTML + "</div>");
                $("#edit-connectioneditors").append($connection);
            }

            $connection.collapse("show");
        }

        this.populateDropdown("edit_connection" + n + "_connectiontype", refData.ConnectionTypes, null);
        this.populateDropdown("edit_connection" + n + "_level", refData.ChargerTypes, null, true);
        this.populateDropdown("edit_connection" + n + "_status", refData.StatusTypes, null);
        this.populateDropdown("edit_connection" + n + "_currenttype", refData.CurrentTypes, null, true);
    }

    var appContext = this;
    appContext.setElementAction("#edit-location-lookup", function (event, ui) {
        var lookupString = ($("#edit_addressinfo_addressline1").val().length > 0 ? $("#edit_addressinfo_addressline1").val() + "," : "") + ($("#edit_addressinfo_addressline2").val().length > 0 ? $("#edit_addressinfo_addressline2").val() + "," : "") + ($("#edit_addressinfo_town").val().length > 0 ? $("#edit_addressinfo_town").val() + "," : "") + ($("#edit_addressinfo_stateorprovince").val().length > 0 ? $("#edit_addressinfo_stateorprovince").val() + "," : "") + ($("#edit_addressinfo_postcode").val().length > 0 ? $("#edit_addressinfo_postcode").val() + "," : "") + appContext.ocm_data.getRefDataByID(refData.Countries, $("#edit_addressinfo_countryid").val()).Title;

        appContext.ocm_geo.determineGeocodedLocation(lookupString, $.proxy(appContext.populateEditorLatLon, appContext));
    });

    appContext.setElementAction("#editlocation-submit", function () {
        if (appContext.validateLocationEditor() === true) {
            appContext.performLocationSubmit();
        }
    });

    this.populateDropdown("comment-type", refData.UserCommentTypes, null);
    this.populateDropdown("checkin-type", refData.CheckinStatusTypes, null);

    this.populateDropdown("edit_submissionstatus", refData.SubmissionStatusTypes, 1);
    this.populateDropdown("edit_dataprovider", refData.DataProviders, 1);

    $("#edit-submissionstatus-container").hide();
    $("#edit-dataprovider-container").hide();

    this.populateDropdown("filter-connectiontype", refData.ConnectionTypes, "", true, false, "(All)");
    this.populateDropdown("filter-operator", refData.Operators, "", true, false, "(All)");
    this.populateDropdown("filter-usagetype", refData.UsageTypes, "", true, false, "(All)");
    this.populateDropdown("filter-statustype", refData.StatusTypes, "", true, false, "(All)");

    this.resetEditorForm();

    if (refData.UserProfile && refData.UserProfile != null && refData.UserProfile.IsCurrentSessionTokenValid == false) {
        if (this.isUserSignedIn()) {
            this.logEvent("Login info is stale, logging out user.");
            this.logout(false);
        }
    } else {
        this.logEvent("No user profile in reference data.");
    }
};

OCM_App.prototype.populateEditorLatLon = function (result) {
    var lat = result.coords.latitude;
    var lng = result.coords.longitude;

    $("#edit_addressinfo_latitude").val(lat);
    $("#edit_addressinfo_longitude").val(lng);

    $("#position-attribution").html(result.attribution);
    this.positionAttribution = result.attribution;

    this.refreshEditorMap();
};

OCM_App.prototype.validateLocationEditor = function () {
    var isValid = true;

    if (isValid == true && $("#edit_addressinfo_title").val().length < 3) {
        this.showMessage("Please provide a descriptive/summary title for this location");
        isValid = false;
    }

    if (isValid == true && $("#edit_addressinfo_latitude").val() == "") {
        this.showMessage("Please provide a valid Latitude or use the lookup button.");
        isValid = false;
    } else if (isValid == true && $("#edit_addressinfo_longitude").val() == "") {
        this.showMessage("Please provide a valid Longitude or use the lookup button.");
        isValid = false;
    }
    return isValid;
};

OCM_App.prototype.performLocationSubmit = function () {
    var refData = this.ocm_data.referenceData;
    var item = this.ocm_data.referenceData.ChargePoint;

    if (this.isLocationEditMode == true)
        item = this.selectedPOI;

    item.AddressInfo.Title = $("#edit_addressinfo_title").val();
    item.AddressInfo.AddressLine1 = $("#edit_addressinfo_addressline1").val();
    item.AddressInfo.AddressLine2 = $("#edit_addressinfo_addressline2").val();
    item.AddressInfo.Town = $("#edit_addressinfo_town").val();
    item.AddressInfo.StateOrProvince = $("#edit_addressinfo_stateorprovince").val();
    item.AddressInfo.Postcode = $("#edit_addressinfo_postcode").val();
    item.AddressInfo.Latitude = $("#edit_addressinfo_latitude").val();
    item.AddressInfo.Longitude = $("#edit_addressinfo_longitude").val();

    var country = this.ocm_data.getRefDataByID(refData.Countries, $("#edit_addressinfo_countryid").val());
    item.AddressInfo.Country = country;
    item.AddressInfo.CountryID = null;

    item.AddressInfo.AccessComments = $("#edit_addressinfo_accesscomments").val();
    item.AddressInfo.ContactTelephone1 = $("#edit_addressinfo_contacttelephone1").val();
    item.AddressInfo.ContactTelephone2 = $("#edit_addressinfo_contacttelephone2").val();
    item.AddressInfo.ContactEmail = $("#edit_addressinfo_contactemail").val();
    item.AddressInfo.RelatedURL = $("#edit_addressinfo_relatedurl").val();

    item.NumberOfPoints = $("#edit_numberofpoints").val();

    item.UsageType = this.ocm_data.getRefDataByID(refData.UsageTypes, $("#edit_usagetype").val());
    item.UsageTypeID = null;

    item.UsageCost = $("#edit_usagecost").val();

    item.StatusType = this.ocm_data.getRefDataByID(refData.StatusTypes, $("#edit_statustype").val());
    item.StatusTypeID = null;

    item.GeneralComments = $("#edit_generalcomments").val();

    item.OperatorInfo = this.ocm_data.getRefDataByID(refData.Operators, $("#edit_operator").val());
    item.OperatorID = null;

    if (this.isLocationEditMode != true) {
        item.DataProvider = null;
        item.DataProviderID = null;

        if (this.hasUserPermissionForPOI(item, "Edit")) {
            item.SubmissionStatus = this.ocm_data.getRefDataByID(refData.SubmissionStatusTypes, 200);
            item.SubmissionStatusTypeID = null;
        }
    } else {
        item.SubmissionStatus = this.ocm_data.getRefDataByID(refData.SubmissionStatusTypes, $("#edit_submissionstatus").val());
        item.SubmissionStatusTypeID = null;
        item.DataProvider = this.ocm_data.getRefDataByID(refData.DataProviders, $("#edit_dataprovider").val());
        item.DataProviderID = null;
    }

    if (item.Connections == null)
        item.Connections = new Array();

    var numConnections = 0;
    for (var n = 1; n <= this.numConnectionEditors; n++) {
        var originalConnection = null;
        if (item.Connections.length >= n) {
            originalConnection = item.Connections[n - 1];
        }

        var connectionInfo = {
            "ID": -1,
            "Reference": null,
            "ConnectionType": this.ocm_data.getRefDataByID(refData.ConnectionTypes, $("#edit_connection" + n + "_connectiontype").val()),
            "StatusType": this.ocm_data.getRefDataByID(refData.StatusTypes, $("#edit_connection" + n + "_status").val()),
            "Level": this.ocm_data.getRefDataByID(refData.ChargerTypes, $("#edit_connection" + n + "_level").val()),
            "CurrentType": this.ocm_data.getRefDataByID(refData.CurrentTypes, $("#edit_connection" + n + "_currenttype").val()),
            "Amps": $("#edit_connection" + n + "_amps").val(),
            "Voltage": $("#edit_connection" + n + "_volts").val(),
            "PowerKW": $("#edit_connection" + n + "_powerkw").val(),
            "Quantity": $("#edit_connection" + n + "_quantity").val()
        };

        if (originalConnection != null) {
            connectionInfo.ID = originalConnection.ID;
            connectionInfo.Reference = originalConnection.Reference;
            connectionInfo.Comments = originalConnection.Comments;
        }

        if (item.Connections.length >= n) {
            item.Connections[n - 1] = connectionInfo;
        } else {
            item.Connections.push(connectionInfo);
        }
    }

    if (this.positionAttribution != null) {
        if (item.MetadataValues == null)
            item.MetadataValues = new Array();
        var attributionMetadata = this.ocm_data.getMetadataValueByMetadataFieldID(item.MetadataValues, this.ocm_data.ATTRIBUTION_METADATAFIELDID);
        if (attributionMetadata != null) {
            attributionMetadata.ItemValue = this.positionAttribution;
        } else {
            attributionMetadata = {
                MetadataFieldID: this.ocm_data.ATTRIBUTION_METADATAFIELDID,
                ItemValue: this.positionAttribution
            };
            item.MetadataValues.push(attributionMetadata);
        }
    } else {
        var attributionMetadata = this.ocm_data.getMetadataValueByMetadataFieldID(item.MetadataValues, this.ocm_data.ATTRIBUTION_METADATAFIELDID);
        if (attributionMetadata != null) {
            item.MetadataValues = jQuery.grep(item.MetadataValues, function (a, i) {
                return a.MetadataFieldID !== this.ocm_data.ATTRIBUTION_METADATAFIELDID;
            });
        }
    }

    this.showProgressIndicator();

    this.ocm_data.submitLocation(item, this.getLoggedInUserInfo(), $.proxy(this.submissionCompleted, this), $.proxy(this.submissionFailed, this));
};

OCM_App.prototype.showLocationEditor = function () {
    this.resetEditorForm();

    if (this.selectedPOI != null) {
        this.isLocationEditMode = true;
        var poi = this.selectedPOI;

        this.positionAttribution = null;

        if (poi.MetadataValues != null) {
            var attributionMetadata = this.ocm_data.getMetadataValueByMetadataFieldID(poi.MetadataValues, this.ocm_data.ATTRIBUTION_METADATAFIELDID);
            if (attributionMetadata != null) {
                this.positionAttribution = attributionMetadata.ItemValue;
            }
        }
        $("#edit_addressinfo_title").val(poi.AddressInfo.Title);
        $("#edit_addressinfo_addressline1").val(poi.AddressInfo.AddressLine1);
        $("#edit_addressinfo_addressline2").val(poi.AddressInfo.AddressLine2);
        $("#edit_addressinfo_town").val(poi.AddressInfo.Town);
        $("#edit_addressinfo_stateorprovince").val(poi.AddressInfo.StateOrProvince);
        $("#edit_addressinfo_postcode").val(poi.AddressInfo.Postcode);
        this.setDropdown("edit_addressinfo_countryid", poi.AddressInfo.Country.ID);
        $("#edit_addressinfo_latitude").val(poi.AddressInfo.Latitude);
        $("#edit_addressinfo_longitude").val(poi.AddressInfo.Longitude);

        this.refreshEditorMap();

        $("#edit_addressinfo_accesscomments").val(poi.AddressInfo.AccessComments);
        $("#edit_addressinfo_contacttelephone1").val(poi.AddressInfo.ContactTelephone1);
        $("#edit_addressinfo_contacttelephone2").val(poi.AddressInfo.ContactTelephone2);
        $("#edit_addressinfo_contactemail").val(poi.AddressInfo.ContactEmail);
        $("#edit_addressinfo_relatedurl").val(poi.AddressInfo.RelatedURL);

        $("#edit_numberofpoints").val(poi.NumberOfPoints);
        $("#edit_usagecost").val(poi.UsageCost);
        $("#edit_generalcomments").val(poi.GeneralComments);

        this.setDropdown("edit_usagetype", poi.UsageType != null ? poi.UsageType.ID : "0");
        this.setDropdown("edit_statustype", poi.StatusType != null ? poi.StatusType.ID : "50");
        this.setDropdown("edit_submissionstatus", poi.SubmissionStatus != null ? poi.SubmissionStatus.ID : "1");
        this.setDropdown("edit_operator", poi.OperatorInfo != null ? poi.OperatorInfo.ID : "1");
        this.setDropdown("edit_dataprovider", poi.DataProvider != null ? poi.DataProvider.ID : "1");

        $("#edit-submissionstatus-container").show();
        $("#edit-operator-container").show();
        $("#edit-dataprovider-container").show();

        if (poi.Connections != null) {
            for (var n = 1; n <= this.numConnectionEditors; n++) {
                var $connection = ($("#edit_connection" + n));

                $connection.removeClass("panel-primary");
                $connection.removeClass("panel-default");

                if (poi.Connections.length >= n) {
                    var con = poi.Connections[n - 1];
                    if (con != null) {
                        if ($connection.length > 0) {
                            this.setDropdown("edit_connection" + n + "_connectiontype", con.ConnectionType != null ? con.ConnectionType.ID : "0");
                            this.setDropdown("edit_connection" + n + "_level", con.Level != null ? con.Level.ID : "");
                            this.setDropdown("edit_connection" + n + "_status", con.StatusType != null ? con.StatusType.ID : "0");
                            this.setDropdown("edit_connection" + n + "_currenttype", con.CurrentType != null ? con.CurrentType.ID : "");

                            $("#edit_connection" + n + "_amps").val(con.Amps);
                            $("#edit_connection" + n + "_volts").val(con.Voltage);
                            $("#edit_connection" + n + "_quantity").val(con.Quantity);
                            $("#edit_connection" + n + "_powerkw").val(con.PowerKW);
                            $connection.data("_connection_id", con.ID);

                            $connection.addClass("panel-primary");
                        }
                    }
                } else {
                    $connection.data("_connection_id", 0);

                    $connection.addClass("panel-default");
                }
            }
        }
    }
};

OCM_App.prototype.refreshEditorMap = function () {
    var lat = parseFloat($("#edit_addressinfo_latitude").val());
    var lng = parseFloat($("#edit_addressinfo_longitude").val());

    if (this.editorMap != null) {
        if (this.editorMap != null) {
            this.editMarker.setLatLng([lat, lng]);
            this.editorMap.panTo([lat, lng]);
            $("#editor-map").show();
        }
    } else {
        this.initEditorMap(lat, lng);
    }
};

OCM_App.prototype.initEditorMap = function (currentLat, currentLng) {
    if (this.editorMapInitialised === false) {
        this.editorMapInitialised = true;
        var app = this;

        $('#edit_addressinfo_latitude, #edit_addressinfo_longitude').change(function () {
            if (app.editorMap != null) {
                app.refreshEditorMap();

                app.positionAttribution = null;
            }
        });

        $("#editor-map").show();
        this.editorMap = this.ocm_ui.createMapLeaflet("editor-map-canvas", currentLat, currentLng, false, 14);

        var unknownPowerMarker = L.AwesomeMarkers.icon({
            icon: 'bolt',
            color: 'darkpurple'
        });

        this.editMarker = new L.Marker(new L.LatLng(currentLat, currentLng), { draggable: true });

        this.editMarker.addTo(this.editorMap);
        $("#editor-map-canvas").show();

        this.editMarker.on("dragend", function () {
            var point = app.editMarker.getLatLng();
            app.editorMap.panTo(point);
            $("#edit_addressinfo_latitude").val(point.lat);
            $("#edit_addressinfo_longitude").val(point.lng);

            app.positionAttribution = null;
        });

        var map = this.editorMap;
        setTimeout(function () {
            map.invalidateSize(false);
        }, 300);
    } else {
        var point = app.editMarker.getLatLng();
        app.editorMap.panTo(point);
    }
};
