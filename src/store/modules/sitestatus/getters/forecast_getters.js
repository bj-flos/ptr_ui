
const forecast = state => state.forecast || []

const dailyForecast = state => state.daily_forecast || []

export default {
  forecast,
  dailyForecast
}
