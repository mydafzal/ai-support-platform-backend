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

module.exports = { formatHubSpotContactDetails, formatTeamGroups };
