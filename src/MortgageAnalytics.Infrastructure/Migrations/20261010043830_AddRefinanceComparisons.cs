using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MortgageAnalytics.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefinanceComparisons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Inputs",
                table: "SavedCalculations",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.AddColumn<string>(
                name: "Refinance",
                table: "SavedCalculations",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Refinance",
                table: "SavedCalculations");

            migrationBuilder.AlterColumn<string>(
                name: "Inputs",
                table: "SavedCalculations",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);
        }
    }
}
