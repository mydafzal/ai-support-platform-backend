function formatHubSpotContactDetails(customer) {
  const properties = customer.properties;

  const formattedDetails = `
        - Name: ${properties.firstname} ${properties.lastname}
        - Email: ${properties.email}
        - Phone: ${properties.phone}
        - Customer ID: ${customer.id}
      `;

  return formattedDetails;
}

function formatTeamGroups(teamGroups) {
  let formattedString = "";

  teamGroups.forEach((item) => {
    formattedString += `- ${item.name}\n`;
  });

  return formattedString;
}

function formatObjectToString(obj) {
  let result = "";

  for (const key in obj) {
    if (Object.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      result += `${key}: ${value}\n`;
    }
  }

  return result;
}

module.exports = {
  formatHubSpotContactDetails,
  formatTeamGroups,
  formatObjectToString,
};
