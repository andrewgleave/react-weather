/**
 * @jsx React.DOM
 */

function getFormattedTemperature(temperature) {
    if(temperature) {
        return <span>{ Math.round(temperature) }<sup>º</sup>C</span>;
    }
    return null;
}

var cx = React.addons.classSet;

var CurrentStatus = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        color: React.PropTypes.string,
        temperature: React.PropTypes.number,
        icon: React.PropTypes.string,
        summary: React.PropTypes.string
    },
    getDefaultProps: function() {
        return {
            color: 'rgba(255, 255, 255, 1)'
        };
    },
    componentDidMount: function() {
        var node = this.refs.icon.getDOMNode();
        this.skycons = new Skycons({ 'color': this.props.color });
        this.skycons.add(node, this.props.icon);
        this.skycons.play();
    },
    componentWillReceiveProps: function(nextProps) {
        if(nextProps.icon !== this.props.icon) {
            var node = this.refs.icon.getDOMNode();
            this.skycons.set(node, nextProps.icon);
        }
    },
    componentWillUnmount: function() {
        this.skycons.remove(this.refs.icon.getDOMNode());
    },
    render: function() {
        return (
            <div className="ww-cur">
                <canvas className="ww-cicon" ref="icon" width="128" height="128"></canvas>
                <span className="ww-ctemp">{ getFormattedTemperature(this.props.temperature) }</span>
                <span className="ww-csum">{ this.props.summary }</span>
            </div>
        );
    }
});

var LocationSearchBar = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        visible: React.PropTypes.bool,
        onComplete: React.PropTypes.func,
        onBlur: React.PropTypes.func
    },
    handleSubmit: function(e) {
        e.preventDefault();
        var node = this.refs.search.getDOMNode();
        var address = node.value.trim();
        if(address) {
            this.props.onComplete(address);
            node.value = '';
        }
    },
    handleClick: function(e) {
        e.stopPropagation();
    },
    componentDidUpdate: function() {
        if(this.props.visible) {
            this.refs.search.getDOMNode().focus();
        }
    },
    render: function() {
        var classes = cx({
            'ww-sf centered-flex': true,
            'show': this.props.visible
        });
        return (
            <form className={ classes } onSubmit={ this.handleSubmit }>
                <input ref="search" 
                    onClick={ this.handleClick }
                    onBlur={ this.props.onBlur }
                    type="input"
                    placeholder="Enter address" />
            </form>
        );
    }
});

var LocationHeader = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        onClick: React.PropTypes.func,
        address: React.PropTypes.string
    },
    calculateFontScaleForAddress: function() {
        if(!this.props.address.length) {
            return;
        }
        var pos = 16 / this.props.address.length;
        var minp = 0.5;
        var maxp = 4;
        var minv = Math.log(1.3125);
        var maxv = Math.log(4.8125);
        var scale = (maxv - minv) / (maxp - minp);
        var size = Math.exp(minv + scale * (pos - minp))
        return {
              fontSize: size + 'rem'
        };
    },
    render: function() {
        return (
            <span style={ this.calculateFontScaleForAddress() } className="ww-ad" onClick={ this.props.onClick }>
                { this.props.address }
            </span>
        );
    }
});

var HourlyOutlookRow = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        color: React.PropTypes.string, 
        temperature: React.PropTypes.number,
        icon: React.PropTypes.string,
        summary: React.PropTypes.string
    },
    componentDidMount: function() {
        var node = this.refs.icon.getDOMNode();
        this.skycons = new Skycons({ 'color': this.props.color });
        this.skycons.add(node, this.props.icon);
        this.skycons.play();
    },
    componentWillReceiveProps: function(nextProps) {
        if(nextProps.icon !== this.props.icon) {
            var node = this.refs.icon.getDOMNode();
            this.skycons.set(node, nextProps.icon);
        }
    },
    componentWillUnmount: function() {
        this.skycons.remove(this.refs.icon.getDOMNode());
    },
    render: function() {
        return (
            <tr>
                <td className="time"><span className="ww-time-h">{ new Date(this.props.time * 1000).getHours() }</span></td>
                <td className="icon"><canvas className="ww-cicon-h" ref="icon" width="28" height="28"></canvas></td>
                <td className="temp"><span className="ww-ctemp-h">{ getFormattedTemperature(this.props.temperature) }</span></td>
                <td className="summary"><span className="ww-csum-h">{ this.props.summary }</span></td>
            </tr>
        );
    }
});

var HourlyOutlookTable = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        visible: React.PropTypes.bool,
        iconColor: React.PropTypes.string,
        data: React.PropTypes.array
    },
    render: function() {
        var rows = this.props.data.map(function(item) {
            return (
                <HourlyOutlookRow
                    key={ 'hor' + item.time }
                    color={ this.props.iconColor }
                    time={ item.time }
                    temperature={ item.apparentTemperature }
                    icon={ item.icon }
                    summary={ item.summary } />
            )
        }.bind(this));
        return (
            <div className={ 'ww-ht' + (this.props.visible ? ' show' : '') }>
                <table className="ww-htb">
                    <tbody>
                        { rows }
                    </tbody>
                </table>
            </div>
        );
    }
});

var WeatherWidget = React.createClass({
    mixins: [React.addons.PureRenderMixin],
    propTypes: {
        initialAddress: React.PropTypes.string
    },
    getInitialState: function() {
        return {
            isLoading: true,
            address: '',
            current: {
                summary: '',
                icon: 'clear-day',
                temperature: ''
            },
            hourly: [],
            showSearch: false,
            showHourly: false
        };
    },
    componentDidMount: function() {
        this.handleLocationChange(this.props.initialAddress);
    },
    handleLocationChange: function(address) {
        this.setState( this.getInitialState() );
        this.load(address);
    },
    handleAddressClick: function(e) {
        e.stopPropagation();
        this.setState({ showSearch: !this.state.showSearch });
    },
    handleSearchBlur: function() {
        this.setState({ showSearch: false });
    },
    handleToggleHourly: function() {
        this.setState({ showHourly: !this.state.showHourly });
    },
    load: function(address) {
        var self = this;
        var r = new XMLHttpRequest();
        r.open('GET', '/weather/?address=' + encodeURIComponent(address));
        r.responseType = 'json';
        r.onload = function() {
            if(this.status === 200) {
                self.setState({
                    address: this.response.formattedAddress,
                    current: this.response.data.currently,
                    hourly: this.response.data.hourly.data.slice(0, 24),
                    isLoading: false,
                    showSearch: false
                });
            }
        };
        r.send();
        this.setState({ isLoading: true });
    },
    render: function() {
        var classes = cx({
            'ww': true,
            'loading': this.state.isLoading,
            'expand': this.state.showHourly
        });
        return (
            <div className={ classes }
                onClick={ this.handleToggleHourly }>
                <LocationSearchBar 
                    visible={ this.state.showSearch }
                    onComplete={ this.handleLocationChange }
                    onBlur={ this.handleSearchBlur } />
                <div className="ww-bc">
                    <LocationHeader
                        onClick={ this.handleAddressClick }
                        address={ this.state.address } />
                    <CurrentStatus
                        temperature={ this.state.current.temperature }
                        icon={ this.state.current.icon }
                        summary={ this.state.current.summary } />
                </div>
                <HourlyOutlookTable 
                    visible={ this.state.showHourly }
                    iconColor='#fff'
                    data={ this.state.hourly } />
            </div>
        );
    }
});

React.renderComponent(
    <WeatherWidget initialAddress="Douglas, Isle of Man" />,
    document.getElementById('container')
);
