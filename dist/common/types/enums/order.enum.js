"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AMC_CYCLE_IN_MONTHS = exports.AMC_FILTER = exports.PURCHASE_TYPE = exports.ORDER_STATUS_ENUM = void 0;
var ORDER_STATUS_ENUM;
(function (ORDER_STATUS_ENUM) {
    ORDER_STATUS_ENUM["ACTIVE"] = "active";
    ORDER_STATUS_ENUM["INACTIVE"] = "inactive";
})(ORDER_STATUS_ENUM || (exports.ORDER_STATUS_ENUM = ORDER_STATUS_ENUM = {}));
var PURCHASE_TYPE;
(function (PURCHASE_TYPE) {
    PURCHASE_TYPE["CUSTOMIZATION"] = "customization";
    PURCHASE_TYPE["LICENSE"] = "license";
    PURCHASE_TYPE["ADDITIONAL_SERVICE"] = "additional_service";
    PURCHASE_TYPE["ORDER"] = "order";
})(PURCHASE_TYPE || (exports.PURCHASE_TYPE = PURCHASE_TYPE = {}));
var AMC_FILTER;
(function (AMC_FILTER) {
    AMC_FILTER["UPCOMING"] = "upcoming";
    AMC_FILTER["ALL"] = "all";
    AMC_FILTER["PAID"] = "paid";
    AMC_FILTER["PENDING"] = "pending";
    AMC_FILTER["OVERDUE"] = "overdue";
    AMC_FILTER["FIRST"] = "first";
})(AMC_FILTER || (exports.AMC_FILTER = AMC_FILTER = {}));
exports.DEFAULT_AMC_CYCLE_IN_MONTHS = 12;
//# sourceMappingURL=order.enum.js.map