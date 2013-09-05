var Statistics = function () {

    
};


Statistics.prototype.sum = function (arr) {

    if (!(arr instanceof Array)) {
        return 0;
    }
    else {
        arr = arr.filter(function(d){ return d != null; });
        if (arr.length == 0) {
            return 0;
        }
        else {
            return arr.reduce(function(a, b){ return a + b; });;
        }
    }
}


Statistics.prototype.min = function (arr) {

    return Math.min.apply(this, arr);
};


Statistics.prototype.max = function (arr) {

    return Math.max.apply(this, arr);
};


Statistics.prototype.mean = function (arr) {

    return this.sum(arr) / arr.length;
};


Statistics.prototype.median = function (arr) {

    var sortedArr = arr.slice(0).sort(function (a, b) { return a - b; });
    var midpoint = (sortedArr.length / 2) >> 0;
    
    if (sortedArr.length % 2 == 1) {
        return sortedArr[midpoint];
    }
    else {
        return this.mean([sortedArr[midpoint - 1], sortedArr[midpoint]]);
    }
};


Statistics.prototype.variance = function (arr) {

    var a = arr.slice(0);
    var aMean = this.mean(a);
    var differences = a.map(function (d) {

        return +(Math.pow(d - aMean, 2)).toFixed(2);
    });
    var sumDiff = this.sum(differences);
    return (1 / (arr.length - 1)) * sumDiff;
};


Statistics.prototype.stdDev = function (arr) {

    return Math.sqrt(this.variance(arr));
};


module.exports = Statistics;